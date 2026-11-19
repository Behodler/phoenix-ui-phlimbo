# phusd-history-indexer

A scheduled AWS Lambda that indexes three on-chain activities from Ethereum mainnet
and publishes them as one cumulative static file, `s3://phusd.behodler.io/history.json`,
served by CloudFront at `https://phoenixdefi.app/history.json`. The UI fetches that file;
there is no API, no API key and no subgraph.

| Activity | Contract (mainnet) | Event |
|---|---|---|
| NFT Bonfire burns | NFTBonfire `0xE5983721f009AB57d464e611C9A06B148cEC3Acc` | `Burned(burner, tokenId, payout)` |
| Antimatter annihilations | Antimatter `0x9CA92B527012DfC6Fdca7B7493C722D5901FF151` | `Annihilated(stable, annihilator, recipient, amount, stableAmount, phUSDAmount)` |
| (Stake-tab attribution) | StableStakerV2 `0xA6d3fc83C91B8319D219cEB12B46e3dfF064B58F` | `AutoAnnihilated(token, user, …)` |
| Discount batch mints | BatchNFTMinterNudgeDiscount `0xD41235bC400BAEDD23aA416Db1F62c944981C42a` | `BatchMinted(recipient, free, paid, paidCost, potReservedUSDC, owedAdded)` |

Addresses, deploy blocks and event signatures live in `lib/config.mjs`, with their provenance
(phase-2-staging `mainnet-addresses.ts`, its broadcast receipts, and the
`@behodler/phase2-wagmi-hooks` ABIs). The Lambda cannot import the UI's `ContractAddresses`.

## Layout

| File | Role |
|---|---|
| `index.mjs` | Handler. Wires S3 (runtime-bundled AWS SDK v3) and a viem client to `runIndexer`. |
| `lib/config.mjs` | Addresses, deploy blocks, event ABIs, RPC defaults, scan tuning. |
| `lib/scan.mjs` | Adaptive chunked range scanner (pure). |
| `lib/history.mjs` | Doc construction/validation, row builders, merge/dedupe, re-attribution (pure). |
| `lib/indexer.mjs` | One run: read → scan → enrich → merge → guarded write. All I/O injected. |
| `test/*.test.mjs` | Vitest unit tests for the pure modules, no network/AWS. Run from the repo root with `yarn test:run`. |
| `deploy.sh` | Idempotent deploy: roles, function, schedule, log retention. |

## history.json (schema v1)

```jsonc
{
  "version": 1,
  "chainId": 1,
  "generatedAt": "<ISO timestamp>",
  "cursors": { "bonfire": <lastScannedBlock>, "antimatter": <n>, "stableStaker": <n>, "batchMint": <n> },
  "tokens": { "<lowercased stable address>": { "symbol": "USDC", "decimals": 6 } },
  "bonfireBurns":  [ { "txHash", "logIndex", "blockNumber", "timestamp", "burner", "tokenId", "payout" } ],
  "annihilations": [ { "txHash", "logIndex", "blockNumber", "timestamp", "user", "source": "forge"|"stake", "stable", "amount", "stableAmount", "phUSDAmount" } ],
  "batchMints":    [ { "txHash", "logIndex", "blockNumber", "timestamp", "recipient", "payer", "free", "paid", "paidCost", "potReservedUSDC", "owedAdded" } ]
}
```

- Every uint256 is a **decimal string**. `logIndex`, `blockNumber` and `timestamp` (unix
  seconds) are numbers. Addresses are checksummed.
- Arrays are sorted ascending by `(blockNumber, logIndex)`; the dedupe key is `txHash:logIndex`.
- `bonfireBurns[].tokenId` is the NFTMinterV2 dispatcher index (the NFT *type*), not a unique
  token; `payout` is Antimatter minted (18 dp). Each burn is one unit.
- `annihilations[].amount` is Antimatter burned (18 dp), `stableAmount` is in the stable's own
  decimals (see `tokens`), `phUSDAmount` is total phUSD delivered (18 dp).
- `source: "stake"` rows come from `StableStakerV2.autoAnnihilate`, whose `Annihilated` log
  names the staker as annihilator. `user` is taken from the `AutoAnnihilated` log in the same tx.
  If that log were ever missing, `user` stays the staker address and a warning is logged.
- `batchMints[].payer` is the tx sender (the event carries only `recipient`). Effective
  discount ≈ `free / (free + paid)`.

## How a run works

1. `GetObject history.json`. A 404 starts a fresh doc with each cursor at deploy block − 1.
   **Any other failure** (403, network, bad JSON, wrong version/chain, malformed shape) aborts the
   run without writing, so a bad read can never wipe history.
2. Upper bound is the `finalized` block, so indexed rows are reorg-safe.
3. Each source is scanned over `(cursor, finalized]` with `eth_getLogs`, starting at 50,000-block
   chunks. On an RPC error the chunk halves (floor 500) and retries; after a success it doubles
   back. Annihilated and AutoAnnihilated are scanned over the same chunks, so their two cursors
   move in lockstep and the tx-hash join always sees both sides.
4. Timestamps come from one `getBlock` per unique block. New stables get `symbol()`/`decimals()`
   once. Batch mints get one `getTransaction` each for `payer`.
5. Rows merge with dedupe. Each cursor advances only to the last block fully scanned.
6. Time budget: with < 30 s left the scan stops and writes what is done. Every run is resumable
   and idempotent, so the first backfill may take several invocations on throttled public RPCs.
7. The object is written (`application/json`, `Cache-Control: public, max-age=300`) only when
   rows were added or a cursor moved, and never when any array would shrink.

## Configuration

Lambda environment (set by `deploy.sh`):

| Var | Default |
|---|---|
| `BUCKET` | `phusd.behodler.io` |
| `OBJECT_KEY` | `history.json` |
| `RPC_URLS` | `https://eth.drpc.org,https://mainnet.gateway.tenderly.co,https://ethereum-rpc.publicnode.com` (viem `fallback`) |

Function: `phusd-history-indexer`, nodejs22.x, arm64, 256 MB, 300 s timeout, reserved
concurrency 1 (no overlapping runs).

## Deploy

Requires AWS CLI v2 credentials with IAM, Lambda, Scheduler, Logs access, plus `npm` and `zip`.

```bash
cd lambda-history
./deploy.sh
```

Idempotent: re-running updates code, config, policies and the schedule in place. It creates or
updates only `phusd-history-*` resources:

- `phusd-history-indexer-role` — `AWSLambdaBasicExecutionRole` + inline policy:
  `s3:GetObject`/`s3:PutObject` on `arn:aws:s3:::phusd.behodler.io/history.json` only, and
  `s3:ListBucket` on the bucket restricted to prefix `history.json` (so a missing object is a 404,
  not a 403).
- `phusd-history-indexer` — the function, with 14-day log retention on its log group.
- `phusd-history-scheduler-role` — trusted by `scheduler.amazonaws.com`, `lambda:InvokeFunction`
  on this function only.
- `phusd-history-indexer-12h` — EventBridge Scheduler, `rate(12 hours)`, no retries.

No API Gateway, no Function URL, no CloudFront invalidation (max-age=300 suffices).

## Invoke / test

Lambdas are never run locally in this repo; testing means invoking the deployed function.

```bash
aws lambda invoke --function-name phusd-history-indexer --region us-east-1 \
  --cli-read-timeout 360 /tmp/history-out.json && cat /tmp/history-out.json
aws logs tail /aws/lambda/phusd-history-indexer --since 15m --region us-east-1
curl -sI https://phoenixdefi.app/history.json        # Cache-Control: public, max-age=300
curl -s  https://phoenixdefi.app/history.json | jq '.cursors, (.bonfireBurns|length), (.annihilations|length), (.batchMints|length)'
aws scheduler get-schedule --name phusd-history-indexer-12h --region us-east-1
```

The response is a summary: `toBlock`, `wrote`, `added`, per-array `counts`, `cursors`, and per-source
`stats` (`stoppedBy`: `done` | `time` | `error`). Repeat the invoke until every cursor equals
`toBlock` to finish the initial backfill. A further invoke with no new events reports `added: 0`.

## Reset / re-backfill

Cursors make the file self-describing. To rebuild one source, download the file, lower that
cursor (for example to the deploy block − 1) and optionally empty its array, upload it back, then
invoke. Dedupe makes overlapping rescans harmless. To rebuild everything, delete the object
(`aws s3 rm s3://phusd.behodler.io/history.json`) and invoke until the backfill completes. The
annihilations scan always starts from the lower of the `antimatter` and `stableStaker` cursors.

## Cost

Twice a day for a few seconds at 256 MB is far inside Lambda's and EventBridge Scheduler's
always-free allowances. S3 storage/requests for one small JSON are fractions of a cent. Logs are
kept 14 days. RPCs are free public endpoints. There is no VPC, NAT or provisioned anything.
If every RPC throttles, the run writes partial progress and resumes on the next schedule.

## Safety

Read-only against the chain (`eth_getLogs`, `eth_getBlockByNumber`, `eth_getTransactionByHash`,
`eth_call`). It never signs or sends a transaction.

The UI deploy (`yarn deploy`) excludes `history.json` from its `aws s3 sync --delete`; without
that exclude every UI deploy would delete the live file.
