// Pure helpers for the history.json document: construction, serialization,
// merge/dedupe, and Stake-tab annihilation re-attribution. No network, no AWS.
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
 * Builds annihilation rows, re-attributing Stake-tab annihilations.
 *
 * StableStakerV2.autoAnnihilate calls antimatter.annihilate(token, address(this), …),
 * so its Annihilated log has annihilator == StableStakerV2 and the real user
 * only appears in the AutoAnnihilated log of the same tx. Such rows become
 * source "stake" with user = AutoAnnihilated.user. If no AutoAnnihilated is
 * found in the tx, the row keeps user = annihilator (source still "stake") and
 * a warning is emitted — never a failure.
 *
 * Within a tx, the k-th Annihilated-from-staker is paired with the k-th
 * AutoAnnihilated by logIndex order (one autoAnnihilate emits exactly one of
 * each; this keeps a hypothetical multi-call tx correct).
 *
 * @param annihilatedLogs  decoded Annihilated logs
 * @param autoLogs         decoded AutoAnnihilated logs covering the same range
 * @param stableStaker     StableStakerV2 address
 * @param timestamps       Map<blockNumber, unixSeconds>
 * @param warn             (msg) => void
 */
export function annihilationRows(annihilatedLogs, autoLogs, stableStaker, timestamps, warn = () => {}) {
  const staker = stableStaker.toLowerCase();
  const autoByTx = new Map();
  for (const l of [...autoLogs].sort((a, b) => Number(a.logIndex) - Number(b.logIndex))) {
    const tx = l.transactionHash.toLowerCase();
    if (!autoByTx.has(tx)) autoByTx.set(tx, []);
    autoByTx.get(tx).push(l);
  }
  const usedPerTx = new Map();
  const sorted = [...annihilatedLogs].sort(
    (a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.logIndex) - Number(b.logIndex),
  );
  return sorted.map((log) => {
    const a = log.args;
    const annihilator = getAddress(a.annihilator);
    let user = annihilator;
    let source = 'forge';
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
    }
    return {
      ...base(log, timestamps.get(Number(log.blockNumber))),
      user,
      source,
      stable: getAddress(a.stable),
      amount: toDecString(a.amount),
      stableAmount: toDecString(a.stableAmount),
      phUSDAmount: toDecString(a.phUSDAmount),
    };
  });
}

/** Total row count across the three arrays. */
export const rowCount = (doc) => ARRAY_KEYS.reduce((n, k) => n + doc[k].length, 0);
