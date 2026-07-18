# FAQ Write Lambda

Authenticated endpoint that lets the admin FAQ editor publish `faq-data.json`
without a rebuild. It **validates** the document, **writes** it to S3, and
**invalidates** the CloudFront path so the change is live in seconds.

See `../docs/FAQ_DATA_EXTERNALIZATION.md` for the overall design and threat model.

## What it does per request

1. `OPTIONS` → CORS preflight response.
2. `PUT` → check `Authorization: Bearer <password>` (timing-safe) → parse JSON →
   **server-side schema validation** → `PutObject` to S3 → CloudFront invalidation.

Only FAQ content is reachable, so auth is a single shared password. The
non-negotiable protection is the server-side validation — a malformed document is
rejected here and never written.

## Quick deploy (recommended)

`deploy.sh` does everything below in one idempotent step — IAM role, function,
env vars, and an API Gateway HTTP API — and prints the endpoint to use as
`VITE_FAQ_API_URL`.
Requires the AWS CLI (authenticated), Node 18+, and `zip`.

```bash
cd lambda
export FAQ_EDITOR_PASSWORD='choose-a-strong-password'
./deploy.sh
```

Re-run it any time to push code changes or refresh the password. The manual steps
below are for reference / customization.

## Build & package for upload

Requires Node 18+ and `zip` on PATH (both present on WSL/Linux).

```bash
cd lambda
npm run build      # installs prod deps and produces function.zip
```

`function.zip` contains `index.js`, `package.json`, and `node_modules`. Upload it
to the Lambda (console → Upload from → .zip file, or the CLI below).

Handler entry point: **`index.handler`**. Runtime: **Node.js 20.x** (or 18.x).

### Create / update via CLI (optional)

```bash
# Update code on an existing function:
aws lambda update-function-code \
  --function-name faq-write \
  --zip-file fileb://function.zip
```

## Configuration (environment variables)

| Variable              | Required | Purpose                                                        |
|-----------------------|----------|----------------------------------------------------------------|
| `BUCKET`              | yes      | Target bucket, e.g. `phusd.behodler.io`                        |
| `OBJECT_KEY`          | no       | Object key (default `faq-data.json`)                          |
| `ALLOWED_ORIGIN`      | no       | CORS origin to reflect, e.g. `https://phusd.behodler.io` (default `*`) |
| `FAQ_EDITOR_PASSWORD` | one of   | Shared password (simplest)                                    |
| `FAQ_SECRET_ARN`      | one of   | Secrets Manager ARN holding the password (preferred)          |
| `DISTRIBUTION_ID`     | no       | CloudFront distribution to invalidate (`E1R43V3HMD4UVM`). Omit to skip. |
| `INVALIDATION_PATH`   | no       | Path to invalidate (default `/faq-data.json`)                |

`FAQ_SECRET_ARN` may hold either a plaintext password or JSON `{"password":"…"}`.

## Minimum IAM policy for the execution role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WriteFaqObject",
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::phusd.behodler.io/faq-data.json"
    },
    {
      "Sid": "InvalidateCdn",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/E1R43V3HMD4UVM"
    },
    {
      "Sid": "ReadSecretOptional",
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "<FAQ_SECRET_ARN>"
    }
  ]
}
```

Drop the `ReadSecretOptional` statement if you use `FAQ_EDITOR_PASSWORD` instead
of Secrets Manager. Keep the AWS-managed `AWSLambdaBasicExecutionRole` for logs.

## Exposing the endpoint

`deploy.sh` provisions an **API Gateway HTTP API** (quick-create: `AWS_PROXY`
integration + catch-all `$default` route + auto-deployed `$default` stage) and
grants API Gateway permission to invoke the Lambda. The endpoint looks like
`https://<api-id>.execute-api.<region>.amazonaws.com/` — set it as
`VITE_FAQ_API_URL` and rebuild the UI.

CORS is **not** configured on the API on purpose: the `$default` route forwards
`OPTIONS` preflights to the Lambda, which returns the CORS headers itself. That
keeps one source of truth for CORS and avoids duplicate `Access-Control-Allow-Origin`
headers.

> **Why not a Lambda Function URL?** It's simpler, but a public (Auth type `NONE`)
> function URL is blocked by this account's AWS Organization policy — it returns
> 403 regardless of the resource policy, and a member account can't override it.
> API Gateway is a different resource type not covered by that guardrail. The
> handler still detects a Function URL event shape, so if you deploy somewhere
> without that org restriction, a Function URL would also work.

Then rebuild the UI so `import.meta.env.VITE_FAQ_API_URL` points at the endpoint.

## Notes

- The object is written with `Cache-Control: public, max-age=60`, so even if an
  invalidation is skipped the edge copy refreshes within ~a minute.
- Payload is re-serialized from the parsed+validated object — raw request bytes
  are never echoed to S3.
