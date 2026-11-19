// Orchestrates one indexer run. All I/O is injected (store, chain, clock),
// so index.mjs only wires S3 + viem and this module stays testable.
import {
  ANTIMATTER,
  BATCH_MINTER_DISCOUNT,
  CHAIN_ID,
  EVENTS,
  NFT_BONFIRE,
  SCAN,
  SCHEMA_VERSION,
  STABLE_STAKER_V2,
} from './config.mjs';
import {
  annihilationRows,
  assertValidDoc,
  batchMintRow,
  burnRow,
  emptyDoc,
  mergeRows,
  rowCount,
} from './history.mjs';
import { scanRange } from './scan.mjs';

/**
 * @param store  { read(): Promise<object|null>  — null ONLY for a missing object (404); throws otherwise
 *                 write(doc): Promise<void> }
 * @param chain  { finalizedBlock(): Promise<number>
 *                 getLogs({ address, event, fromBlock, toBlock }): Promise<DecodedLog[]>
 *                 blockTimestamp(n): Promise<number>
 *                 txFrom(hash): Promise<string>
 *                 tokenMeta(address): Promise<{ symbol, decimals }> }
 * @param remainingMs  () => number  (Lambda context.getRemainingTimeInMillis)
 * @param log          (msg) => void
 * @param now          () => Date
 * @param scan         overrides for SCAN (tests)
 */
export async function runIndexer({ store, chain, remainingMs, log = console.log, now = () => new Date(), scan = SCAN }) {
  // 1. Read. Any failure other than "not found" aborts the run without writing.
  const read = await store.read();
  const prev = read
    ? assertValidDoc(read, { chainId: CHAIN_ID, version: SCHEMA_VERSION })
    : emptyDoc({
        chainId: CHAIN_ID,
        version: SCHEMA_VERSION,
        deployBlocks: {
          bonfire: NFT_BONFIRE.deployBlock,
          antimatter: ANTIMATTER.deployBlock,
          stableStaker: STABLE_STAKER_V2.deployBlock,
          batchMint: BATCH_MINTER_DISCOUNT.deployBlock,
        },
      });
  log(read ? `read history.json: ${rowCount(prev)} rows, cursors ${JSON.stringify(prev.cursors)}` : 'history.json not found; starting from deploy blocks');

  const doc = structuredClone(prev);
  // 2. Reorg-safe upper bound.
  const toBlock = await chain.finalizedBlock();
  log(`finalized block ${toBlock}`);

  const shouldStop = () => remainingMs() < scan.reserveMs;
  const tsCache = new Map();
  const timestamps = async (logs) => {
    for (const n of new Set(logs.map((l) => Number(l.blockNumber)))) {
      if (!tsCache.has(n)) tsCache.set(n, await chain.blockTimestamp(n));
    }
    return tsCache;
  };
  const scanOpts = (label) => ({
    toBlock,
    initialChunk: scan.initialChunk,
    minChunk: scan.minChunk,
    maxChunk: scan.maxChunk,
    shouldStop,
    log: (m) => log(`[${label}] ${m}`),
  });
  const stats = {};

  // 3a/4. Annihilations: Antimatter.Annihilated and StableStakerV2.AutoAnnihilated
  // are scanned over the SAME ranges so the tx-hash join always has both sides;
  // their cursors therefore advance in lockstep.
  {
    const from = Math.min(doc.cursors.antimatter, doc.cursors.stableStaker) + 1;
    const res = await scanRange({
      ...scanOpts('annihilations'),
      fromBlock: from,
      fetchChunk: async (f, t) => {
        const [ann, auto] = await Promise.all([
          chain.getLogs({ address: ANTIMATTER.address, event: EVENTS.annihilated, fromBlock: f, toBlock: t }),
          chain.getLogs({ address: STABLE_STAKER_V2.address, event: EVENTS.autoAnnihilated, fromBlock: f, toBlock: t }),
        ]);
        return [...ann.map((l) => ({ kind: 'ann', l })), ...auto.map((l) => ({ kind: 'auto', l }))];
      },
    });
    const ann = res.items.filter((i) => i.kind === 'ann').map((i) => i.l);
    const auto = res.items.filter((i) => i.kind === 'auto').map((i) => i.l);
    try {
      const ts = await timestamps(ann);
      const rows = annihilationRows(ann, auto, STABLE_STAKER_V2.address, ts, (m) => log(`WARN ${m}`));
      for (const r of rows) {
        const key = r.stable.toLowerCase();
        if (!doc.tokens[key]) doc.tokens[key] = await chain.tokenMeta(r.stable);
      }
      const { rows: merged, added } = mergeRows(doc.annihilations, rows);
      doc.annihilations = merged;
      doc.cursors.antimatter = Math.max(doc.cursors.antimatter, res.lastScanned);
      doc.cursors.stableStaker = Math.max(doc.cursors.stableStaker, res.lastScanned);
      stats.annihilations = { added, stoppedBy: res.stoppedBy, cursor: res.lastScanned };
    } catch (err) {
      log(`[annihilations] enrichment failed, cursor not advanced: ${err?.message ?? err}`);
      stats.annihilations = { added: 0, stoppedBy: 'enrich-error' };
    }
  }

  // 3b. Bonfire burns.
  {
    const res = await scanRange({
      ...scanOpts('bonfire'),
      fromBlock: doc.cursors.bonfire + 1,
      fetchChunk: (f, t) => chain.getLogs({ address: NFT_BONFIRE.address, event: EVENTS.burned, fromBlock: f, toBlock: t }),
    });
    try {
      const ts = await timestamps(res.items);
      const rows = res.items.map((l) => burnRow(l, ts.get(Number(l.blockNumber))));
      const { rows: merged, added } = mergeRows(doc.bonfireBurns, rows);
      doc.bonfireBurns = merged;
      doc.cursors.bonfire = Math.max(doc.cursors.bonfire, res.lastScanned);
      stats.bonfire = { added, stoppedBy: res.stoppedBy, cursor: res.lastScanned };
    } catch (err) {
      log(`[bonfire] enrichment failed, cursor not advanced: ${err?.message ?? err}`);
      stats.bonfire = { added: 0, stoppedBy: 'enrich-error' };
    }
  }

  // 3c. Discount batch mints (payer = tx.from; one getTransaction per batch).
  {
    const res = await scanRange({
      ...scanOpts('batchMints'),
      fromBlock: doc.cursors.batchMint + 1,
      fetchChunk: (f, t) =>
        chain.getLogs({ address: BATCH_MINTER_DISCOUNT.address, event: EVENTS.batchMinted, fromBlock: f, toBlock: t }),
    });
    try {
      const ts = await timestamps(res.items);
      const known = new Set(doc.batchMints.map((r) => `${r.txHash.toLowerCase()}:${r.logIndex}`));
      const rows = [];
      for (const l of res.items) {
        if (known.has(`${l.transactionHash.toLowerCase()}:${Number(l.logIndex)}`)) continue;
        rows.push(batchMintRow(l, ts.get(Number(l.blockNumber)), await chain.txFrom(l.transactionHash)));
      }
      const { rows: merged, added } = mergeRows(doc.batchMints, rows);
      doc.batchMints = merged;
      doc.cursors.batchMint = Math.max(doc.cursors.batchMint, res.lastScanned);
      stats.batchMints = { added, stoppedBy: res.stoppedBy, cursor: res.lastScanned };
    } catch (err) {
      log(`[batchMints] enrichment failed, cursor not advanced: ${err?.message ?? err}`);
      stats.batchMints = { added: 0, stoppedBy: 'enrich-error' };
    }
  }

  // 5/7. Write only if something changed, and never a smaller doc than we read.
  const added = Object.values(stats).reduce((n, s) => n + s.added, 0);
  const cursorMoved = Object.keys(doc.cursors).some((k) => doc.cursors[k] !== prev.cursors[k]);
  const counts = { bonfireBurns: doc.bonfireBurns.length, annihilations: doc.annihilations.length, batchMints: doc.batchMints.length };
  for (const k of Object.keys(counts)) {
    if (counts[k] < prev[k].length) throw new Error(`refusing to write: ${k} would shrink ${prev[k].length} → ${counts[k]}`);
  }
  let wrote = false;
  if (added > 0 || cursorMoved || !read) {
    doc.generatedAt = now().toISOString();
    await store.write(doc);
    wrote = true;
  }
  const summary = { toBlock, wrote, added, counts, cursors: doc.cursors, stats };
  log(`summary ${JSON.stringify(summary)}`);
  return summary;
}
