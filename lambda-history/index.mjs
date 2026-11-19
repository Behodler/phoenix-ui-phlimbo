// phusd-history-indexer — scheduled (12h) Lambda.
//
// Incrementally indexes NFTBonfire.Burned, Antimatter.Annihilated (with
// StableStakerV2.AutoAnnihilated re-attribution) and
// BatchNFTMinterNudgeDiscount.BatchMinted from Ethereum mainnet into
// s3://$BUCKET/$OBJECT_KEY (history.json, schema v1). Read-only against the
// chain: eth_getLogs, eth_getBlockByNumber, eth_getTransactionByHash, eth_call.
// See README.md.
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPublicClient, fallback, http } from 'viem';
import { mainnet } from 'viem/chains';
import { DEFAULT_RPC_URLS, ERC20_METADATA_ABI } from './lib/config.mjs';
import { stringifyDoc } from './lib/history.mjs';
import { runIndexer } from './lib/indexer.mjs';

const BUCKET = process.env.BUCKET ?? 'phusd.behodler.io';
const OBJECT_KEY = process.env.OBJECT_KEY ?? 'history.json';
const RPC_URLS = (process.env.RPC_URLS ?? DEFAULT_RPC_URLS.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const s3 = new S3Client({});
const client = createPublicClient({
  chain: mainnet,
  transport: fallback(
    RPC_URLS.map((url) => http(url, { timeout: 20_000, retryCount: 1, retryDelay: 500 })),
    { retryCount: 0 },
  ),
});

const store = {
  async read() {
    try {
      const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: OBJECT_KEY }));
      const body = await out.Body.transformToString();
      return JSON.parse(body); // a parse error throws → run aborts, nothing written
    } catch (err) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  },
  async write(doc) {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: OBJECT_KEY,
        Body: stringifyDoc(doc),
        ContentType: 'application/json',
        CacheControl: 'public, max-age=300',
      }),
    );
  },
};

const chain = {
  async finalizedBlock() {
    const b = await client.getBlock({ blockTag: 'finalized' });
    return Number(b.number);
  },
  getLogs({ address, event, fromBlock, toBlock }) {
    return client.getLogs({ address, event, fromBlock: BigInt(fromBlock), toBlock: BigInt(toBlock), strict: true });
  },
  async blockTimestamp(n) {
    const b = await client.getBlock({ blockNumber: BigInt(n) });
    return Number(b.timestamp);
  },
  async txFrom(hash) {
    const tx = await client.getTransaction({ hash });
    return tx.from;
  },
  async tokenMeta(address) {
    const [symbol, decimals] = await Promise.all([
      client.readContract({ address, abi: ERC20_METADATA_ABI, functionName: 'symbol' }),
      client.readContract({ address, abi: ERC20_METADATA_ABI, functionName: 'decimals' }),
    ]);
    return { symbol, decimals: Number(decimals) };
  },
};

export const handler = async (_event, context) => {
  const summary = await runIndexer({
    store,
    chain,
    remainingMs: () => context.getRemainingTimeInMillis(),
  });
  return summary;
};
