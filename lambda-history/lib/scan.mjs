// Adaptive chunked block-range scanner. Pure control flow: the actual RPC
// call is injected as fetchChunk(fromBlock, toBlock), so this is unit-testable
// with no network.

/**
 * Scans the inclusive block range [fromBlock, toBlock] in chunks.
 *
 * - On a fetch error the chunk is halved (never below minChunk) and the same
 *   start block is retried. An error at minChunk ends the scan.
 * - After a success the chunk doubles again, up to maxChunk.
 * - Before each chunk, shouldStop() is consulted (time budget); if it returns
 *   true the scan ends cleanly.
 *
 * Returns { items, lastScanned, chunk, stoppedBy } where lastScanned is the
 * last block FULLY scanned (fromBlock − 1 if nothing was), so a caller can
 * safely advance its cursor to it. stoppedBy is 'done' | 'time' | 'error'.
 */
export async function scanRange({
  fromBlock,
  toBlock,
  fetchChunk,
  initialChunk,
  minChunk,
  maxChunk,
  shouldStop = () => false,
  log = () => {},
}) {
  const items = [];
  let chunk = Math.max(minChunk, Math.min(initialChunk, maxChunk));
  let start = fromBlock;
  let lastScanned = fromBlock - 1;
  let lastError;

  while (start <= toBlock) {
    if (shouldStop()) {
      log(`time budget reached at block ${start}`);
      return { items, lastScanned, chunk, stoppedBy: 'time' };
    }
    const end = Math.min(start + chunk - 1, toBlock);
    try {
      const got = await fetchChunk(start, end);
      items.push(...got);
      log(`scanned ${start}-${end} (chunk ${chunk}): ${got.length} logs`);
      lastScanned = end;
      start = end + 1;
      chunk = Math.min(chunk * 2, maxChunk);
    } catch (err) {
      lastError = err;
      if (chunk <= minChunk) {
        log(`giving up at ${start}-${end} (chunk ${chunk}): ${errMessage(err)}`);
        return { items, lastScanned, chunk, stoppedBy: 'error', error: lastError };
      }
      const next = Math.max(minChunk, Math.floor(chunk / 2));
      log(`error at ${start}-${end} (chunk ${chunk}), halving to ${next}: ${errMessage(err)}`);
      chunk = next;
    }
  }
  return { items, lastScanned, chunk, stoppedBy: 'done' };
}

function errMessage(err) {
  const m = err?.shortMessage ?? err?.message ?? String(err);
  return m.split('\n')[0].slice(0, 200);
}
