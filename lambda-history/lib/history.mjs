// Pure helpers for the history.json document: construction, serialization,
// merge/dedupe, and Stake/Boost annihilation re-attribution. No network, no AWS.
import { getAddress } from 'viem';

export const ARRAY_KEYS = ['bonfireBurns', 'annihilations', 'batchMints'];

/**
 * A fresh v1 document. Each cursor starts one block before the source's
 * deploy block, so the first scan covers (deployBlock − 1, toBlock].
 */
export function emptyDoc({ chainId, version, deployBlocks }) {
  return {
    version,
    chainId,
    generatedAt: new Date(0).toISOString(),
    cursors: {
      bonfire: deployBlocks.bonfire - 1,
      antimatter: deployBlocks.antimatter - 1,
      stableStaker: deployBlocks.stableStaker - 1,
      batchMint: deployBlocks.batchMint - 1,
    },
    tokens: {},
    bonfireBurns: [],
    annihilations: [],
    batchMints: [],
  };
}

/**
 * Validates a document read from storage. Throws on anything that is not a
 * well-formed v1 doc for this chain — the caller must then abort WITHOUT
 * writing, so a corrupted read can never wipe history.
 */
export function assertValidDoc(doc, { chainId, version }) {
  if (!doc || typeof doc !== 'object') throw new Error('history doc is not an object');
  if (doc.version !== version) throw new Error(`history doc version ${doc.version} != ${version}`);
  if (doc.chainId !== chainId) throw new Error(`history doc chainId ${doc.chainId} != ${chainId}`);
  for (const k of ['bonfire', 'antimatter', 'stableStaker', 'batchMint']) {
    if (!Number.isInteger(doc.cursors?.[k])) throw new Error(`history doc cursor ${k} missing`);
  }
  if (!doc.tokens || typeof doc.tokens !== 'object') throw new Error('history doc tokens missing');
  for (const k of ARRAY_KEYS) {
    if (!Array.isArray(doc[k])) throw new Error(`history doc ${k} is not an array`);
  }
  return doc;
}

/** bigint → decimal string; everything else unchanged. */
export function toDecString(v) {
  return typeof v === 'bigint' ? v.toString(10) : String(v);
}

/** JSON.stringify that serializes any stray bigint as a decimal string. */
export function stringifyDoc(doc) {
  return JSON.stringify(doc, (_k, v) => (typeof v === 'bigint' ? v.toString(10) : v), 2);
}

export const rowKey = (row) => `${row.txHash.toLowerCase()}:${row.logIndex}`;

const compareRows = (a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex;

/**
 * Merges new rows into existing ones. Dedupe key is txHash:logIndex; an
 * existing row always wins (rows are immutable once finalized). Result is
 * sorted ascending by (blockNumber, logIndex). Returns { rows, added }.
 */
export function mergeRows(existing, incoming) {
  const seen = new Map(existing.map((r) => [rowKey(r), r]));
  let added = 0;
  for (const r of incoming) {
    const k = rowKey(r);
    if (!seen.has(k)) {
      seen.set(k, r);
      added++;
    }
  }
  const rows = [...seen.values()].sort(compareRows);
  return { rows, added };
}

// ----- Row builders (decoded viem logs → schema rows) ------------------------

const base = (log, timestamp) => ({
  txHash: log.transactionHash,
  logIndex: Number(log.logIndex),
  blockNumber: Number(log.blockNumber),
  timestamp,
});

export function burnRow(log, timestamp) {
  const a = log.args;
  return {
    ...base(log, timestamp),
    burner: getAddress(a.burner),
    tokenId: toDecString(a.tokenId),
    payout: toDecString(a.payout),
  };
}

export function batchMintRow(log, timestamp, payer) {
  const a = log.args;
  return {
    ...base(log, timestamp),
    recipient: getAddress(a.recipient),
    payer: getAddress(payer),
    free: toDecString(a.free),
    paid: toDecString(a.paid),
    paidCost: toDecString(a.paidCost),
    potReservedUSDC: toDecString(a.potReservedUSDC),
    owedAdded: toDecString(a.owedAdded),
  };
}

/**
 * Builds annihilation rows, re-attributing Stake-tab and Boost annihilations.
 *
 * StableStakerV2.autoAnnihilate calls antimatter.annihilate(token, address(this), …),
 * so its Annihilated log has annihilator == StableStakerV2 and the real user
 * only appears in the AutoAnnihilated log of the same tx. Such rows become
 * source "stake" with user = AutoAnnihilated.user. If no AutoAnnihilated is
 * found in the tx, the row keeps user = annihilator (source still "stake") and
 * a warning is emitted — never a failure.
 *
 * AntimatterBooster.boostedAnnihilate does the same from the booster and emits
 * BoostedAnnihilation(user, recipient, stable, amount, stableAmount, basePhUSD,
 * bonusPhUSD) after the Annihilated log. Such rows become source "boost" with
 * user = BoostedAnnihilation.user and bonusPhUSD. phUSDAmount stays the
 * Annihilated value (base); a differing basePhUSD only warns. Unpaired: source
 * "boost", user = booster, no bonusPhUSD, and a warning.
 *
 * Within a tx, the k-th Annihilated-from-staker (or -booster) is paired with
 * the k-th AutoAnnihilated (or BoostedAnnihilation) by logIndex order.
 *
 * @param annihilatedLogs  decoded Annihilated logs
 * @param autoLogs         decoded AutoAnnihilated logs covering the same range
 * @param stableStaker     StableStakerV2 address
 * @param timestamps       Map<blockNumber, unixSeconds>
 * @param warn             (msg) => void
 * @param options          { boostedLogs: decoded BoostedAnnihilation logs covering the same range,
 *                           booster: AntimatterBooster address (zero/absent disables boost pairing) }
 */
export function annihilationRows(annihilatedLogs, autoLogs, stableStaker, timestamps, warn = () => {}, options = {}) {
  const { boostedLogs = [], booster } = options;
  const staker = stableStaker.toLowerCase();
  const boosterLc = isZeroAddress(booster) ? null : booster.toLowerCase();
  const autoByTx = groupByTx(autoLogs);
  const boostByTx = groupByTx(boostedLogs);
  const usedPerTx = new Map();
  const usedBoostPerTx = new Map();
  const sorted = [...annihilatedLogs].sort(
    (a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.logIndex) - Number(b.logIndex),
  );
  return sorted.map((log) => {
    const a = log.args;
    const annihilator = getAddress(a.annihilator);
    let user = annihilator;
    let source = 'forge';
    let bonusPhUSD;
    if (annihilator.toLowerCase() === staker) {
      source = 'stake';
      const tx = log.transactionHash.toLowerCase();
      const idx = usedPerTx.get(tx) ?? 0;
      const match = autoByTx.get(tx)?.[idx];
      usedPerTx.set(tx, idx + 1);
      if (match) {
        user = getAddress(match.args.user);
      } else {
        warn(`No AutoAnnihilated found for stake annihilation ${log.transactionHash}:${log.logIndex}; keeping user = StableStakerV2`);
      }
    } else if (boosterLc && annihilator.toLowerCase() === boosterLc) {
      source = 'boost';
      const tx = log.transactionHash.toLowerCase();
      const idx = usedBoostPerTx.get(tx) ?? 0;
      const match = boostByTx.get(tx)?.[idx];
      usedBoostPerTx.set(tx, idx + 1);
      if (match) {
        user = getAddress(match.args.user);
        bonusPhUSD = toDecString(match.args.bonusPhUSD);
        if (BigInt(match.args.basePhUSD) !== BigInt(a.phUSDAmount)) {
          warn(
            `BoostedAnnihilation basePhUSD ${toDecString(match.args.basePhUSD)} != Annihilated phUSDAmount ${toDecString(a.phUSDAmount)} for ${log.transactionHash}:${log.logIndex}; keeping the Annihilated value`,
          );
        }
      } else {
        warn(`No BoostedAnnihilation found for boost annihilation ${log.transactionHash}:${log.logIndex}; keeping user = AntimatterBooster`);
      }
    }
    const row = {
      ...base(log, timestamps.get(Number(log.blockNumber))),
      user,
      source,
      stable: getAddress(a.stable),
      amount: toDecString(a.amount),
      stableAmount: toDecString(a.stableAmount),
      phUSDAmount: toDecString(a.phUSDAmount),
    };
    if (bonusPhUSD !== undefined) row.bonusPhUSD = bonusPhUSD;
    return row;
  });
}

/** True for a missing, empty or all-zero address. */
export function isZeroAddress(address) {
  return !address || /^0x0{40}$/i.test(address);
}

function groupByTx(logs) {
  const byTx = new Map();
  for (const l of [...logs].sort((a, b) => Number(a.logIndex) - Number(b.logIndex))) {
    const tx = l.transactionHash.toLowerCase();
    if (!byTx.has(tx)) byTx.set(tx, []);
    byTx.get(tx).push(l);
  }
  return byTx;
}

/**
 * Rebuilds a decoded-Annihilated-shaped log from a stored annihilation row
 * whose annihilator was `annihilator`, so stored rows can be re-run through
 * annihilationRows (stale-row repair). Timestamps come from the row itself.
 */
export function annihilatedLogFromRow(row, annihilator) {
  return {
    transactionHash: row.txHash,
    logIndex: row.logIndex,
    blockNumber: BigInt(row.blockNumber),
    args: {
      stable: row.stable,
      annihilator,
      recipient: annihilator,
      amount: BigInt(row.amount),
      stableAmount: BigInt(row.stableAmount),
      phUSDAmount: BigInt(row.phUSDAmount),
    },
  };
}

/**
 * Replaces existing rows in place by txHash:logIndex. Never adds or removes a
 * row: a replacement with no matching key is ignored. A replacement counts
 * only when it differs from the stored row. Returns { rows, replaced }.
 */
export function replaceRows(existing, replacements) {
  const byKey = new Map(replacements.map((r) => [rowKey(r), r]));
  let replaced = 0;
  const rows = existing.map((r) => {
    const next = byKey.get(rowKey(r));
    if (!next || JSON.stringify(next) === JSON.stringify(r)) return r;
    replaced++;
    return next;
  });
  return { rows, replaced };
}

/** Total row count across the three arrays. */
export const rowCount = (doc) => ARRAY_KEYS.reduce((n, k) => n + doc[k].length, 0);
