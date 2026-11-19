# `history.json` — S3-only activity history

`history.json` follows the same pattern as `faq-data.json` (see
[FAQ_DATA_EXTERNALIZATION.md](./FAQ_DATA_EXTERNALIZATION.md)): a JSON object that
lives **only** in the S3 bucket, never in `public/` or the build output, and that the UI
fetches at a root-relative path.

| | |
|---|---|
| Object | `s3://phusd.behodler.io/history.json` |
| URL | `https://phoenixdefi.app/history.json` (fetch as `/history.json`) |
| Writer | the `phusd-history-indexer` Lambda, every 12 h (`lambda-history/`) |
| Cache | `Cache-Control: public, max-age=300`; no CloudFront invalidation |
| Contents | NFT Bonfire burns, Antimatter annihilations (Forge + Stake), discount batch mints |

The schema (v1) and the indexer's behaviour are documented in
[`lambda-history/README.md`](../lambda-history/README.md).

## Wiring that keeps it alive

- **Deploy exclude.** The root `package.json` `deploy` script passes
  `--exclude "history.json"` to the second `aws s3 sync … --delete`. Without it, every UI
  deploy deletes the live file, and the history is empty until the Lambda's next run rebuilds
  it from scratch.
- **Dev proxy.** `vite.config.ts` proxies `/history.json` to `https://phoenixdefi.app`, as
  it does for `/faq-data.json`. Otherwise the dev server answers with its SPA `index.html`
  fallback, and the JSON parse fails.
- **CloudFront.** `cloudfront/spa-router.js` only rewrites dot-less paths, so
  `/history.json` passes through to S3 unchanged.
