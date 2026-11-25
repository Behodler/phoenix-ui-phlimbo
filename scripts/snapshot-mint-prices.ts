/**
 * Read-only generator for `src/data/nftMintPriceSnapshot.mainnet.json`.
 *
 * Scans every NFTMinterV2 `ClaimMinted` log on mainnet from the minter's deploy
 * block up to a pinned `--block`, for ALL recipients, and writes the raw entries
 * (index, token, raw pricePaid) through the same serialiser the browser parses
 * with. A rerun at the same block is byte-identical.
 *
 * Usage:
 *   SNAPSHOT_RPC_URL=<mainnet rpc> yarn snapshot:mint-prices --block <B> [--from <block>]
 *
 * The RPC comes ONLY from `SNAPSHOT_RPC_URL` in the process environment, passed
 * per invocation. There is deliberately no fallback to any `VITE_*` variable
 * and no hard-coded URL: never write the URL into this repo.
 *
 * Read-only: `getLogs` / `getBlockNumber` only. No wallet, no signing.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, getAbiItem, http } from 'viem';
import { mainnet } from 'viem/chains';
import { nftMinterV2Abi } from '@behodler/phase2-wagmi-hooks';
import { mainnetAddresses } from '../src/types/generated/phStaging2/mainnet-addresses.ts';
import {
  MAINNET_NFT_MINTER_DEPLOY_BLOCK,
  buildSnapshot,
  parseClaimMintedLogs,
  serialiseSnapshot,
  type RecipientMintEntry,
} from '../src/utils/nftMintPrices.ts';

const CLAIM_MINTED = getAbiItem({ abi: nftMinterV2Abi, name: 'ClaimMinted' });

const OUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/data/nftMintPriceSnapshot.mainnet.json',
);

const INITIAL_CHUNK = 50_000;
const MIN_CHUNK = 500;
const MAX_CHUNK = 200_000;

function fail(message: string): never {
  console.error(`snapshot-mint-prices: ${message}`);
  process.exit(1);
}

function parseArgs(argv: readonly string[]): { block: number; from: number } {
  let block: number | undefined;
  let from = MAINNET_NFT_MINTER_DEPLOY_BLOCK;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--block') {
      block = Number(next);
      i++;
    } else if (arg === '--from') {
      from = Number(next);
      i++;
    } else {
      fail(`unknown argument "${arg}"`);
    }
  }
  if (block === undefined || !Number.isSafeInteger(block) || block <= 0) {
    fail('--block <B> is required (a positive integer) so runs are reproducible');
  }
  if (!Number.isSafeInteger(from) || from < 0) fail('--from must be a non-negative integer');
  if (from > block) fail(`--from (${from}) is after --block (${block})`);
  return { block, from };
}

function errMessage(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string } | undefined;
  return (e?.shortMessage ?? e?.message ?? String(err)).split('\n')[0].slice(0, 200);
}

/**
 * Adaptive chunked scan, ported from `lambda-history/lib/scan.mjs` `scanRange`:
 * halve the chunk on error (never below MIN_CHUNK; an error at MIN_CHUNK aborts),
 * double it again after each success up to MAX_CHUNK.
 */
async function scanRange<T>(
  fromBlock: number,
  toBlock: number,
  fetchChunk: (from: number, to: number) => Promise<T[]>,
): Promise<T[]> {
  const items: T[] = [];
  let chunk = Math.max(MIN_CHUNK, Math.min(INITIAL_CHUNK, MAX_CHUNK));
  let start = fromBlock;
  while (start <= toBlock) {
    const end = Math.min(start + chunk - 1, toBlock);
    try {
      const got = await fetchChunk(start, end);
      items.push(...got);
      console.error(`scanned ${start}-${end} (chunk ${chunk}): ${got.length} logs`);
      start = end + 1;
      chunk = Math.min(chunk * 2, MAX_CHUNK);
    } catch (err) {
      if (chunk <= MIN_CHUNK) {
        fail(`giving up at ${start}-${end} (chunk ${chunk}): ${errMessage(err)}`);
      }
      const next = Math.max(MIN_CHUNK, Math.floor(chunk / 2));
      console.error(`error at ${start}-${end} (chunk ${chunk}), halving to ${next}: ${errMessage(err)}`);
      chunk = next;
    }
  }
  return items;
}

async function main(): Promise<void> {
  const { block, from } = parseArgs(process.argv.slice(2));

  const rpcUrl = process.env.SNAPSHOT_RPC_URL;
  if (!rpcUrl || rpcUrl.trim() === '') {
    fail('SNAPSHOT_RPC_URL is not set. Pass a mainnet RPC URL for this invocation only.');
  }

  const minter = mainnetAddresses.NFTMinter as `0x${string}`;
  const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });

  const head = await client.getBlockNumber();
  if (BigInt(block) > head) fail(`--block ${block} is ahead of the chain head ${head}`);

  console.error(`scanning ClaimMinted on ${minter} from ${from} to ${block}`);
  const entries = await scanRange<RecipientMintEntry>(from, block, async (start, end) => {
    const logs = await client.getLogs({
      address: minter,
      event: CLAIM_MINTED,
      fromBlock: BigInt(start),
      toBlock: BigInt(end),
    });
    return parseClaimMintedLogs(logs);
  });

  const snapshot = buildSnapshot({
    chainId: mainnet.id,
    minter,
    fromBlock: from,
    snapshotBlock: block,
    entries,
  });
  writeFileSync(OUT_PATH, serialiseSnapshot(snapshot));
  console.error(
    `wrote ${entries.length} entries for ${Object.keys(snapshot.users).length} users to ${OUT_PATH}`,
  );
}

main().catch((err: unknown) => fail(errMessage(err)));
