# Plan: Externalize `faq-data.json` for Rebuild-Free Updates

## Status

**Implemented — 2026-07-18.** The S3 object `s3://phusd.behodler.io/faq-data.json`
is live and authoritative. Local changes landed:

- `src/components/vault/FAQ.tsx` — static import replaced with a runtime
  `fetch('/faq-data.json')` (degrades to empty on failure).
- `package.json` — deploy sync now carries `--exclude "faq-data.json"`.
- `src/assets/faq-data.json` — moved to `docs/faq-data.seed.json` (seed/reference only).

The "Steps" section below is retained as the record of what was done. See
[Future: No-Code Admin Editor](#future-no-code-admin-editor) for the next phase.

## Goal

Move `src/assets/faq-data.json` out of the JS bundle so the FAQ content can be
updated by editing a single file in the existing S3 bucket — **without a rebuild**
and **without `yarn deploy` overwriting or deleting it**.

## Current Situation

- `faq-data.json` is a **static import** in `src/components/vault/FAQ.tsx:3`:
  ```ts
  import faqDataJson from '../../assets/faq-data.json';
  ```
  Vite inlines this JSON into the JS bundle at build time, so any edit requires a
  full rebuild + deploy.

- Deploy script (`package.json`):
  ```
  yarn build && aws s3 sync dist/build s3://phusd.behodler.io --delete && yarn aws:invalidate
  ```
  The `--delete` flag removes any bucket object not present in `dist/build`, so a
  manually uploaded FAQ file would be wiped on the next deploy.

- CloudFront distribution: `E1R43V3HMD4UVM` (from `scripts/invalidateCDN.sh`),
  invalidates `/*` on each deploy.

## Approach

Serve the JSON as a static asset from the same S3/CloudFront origin and fetch it at
runtime via a root-relative URL (same origin → no protocol, no host, no CORS).
Keep the file **out of the build output** so the deploy sync never touches it.

### Why not `public/`

Vite copies `public/*` verbatim into `dist/build`. If the file lived there, every
deploy would overwrite the live-edited S3 copy with the repo's stale copy. The file
must live **only** in S3.

## Steps

### 1. Remove the file from the build

- Delete `src/assets/faq-data.json` from the bundled source tree.
- Keep a **seed copy** in the repo for the initial upload and for reference, but in a
  location Vite does **not** bundle — e.g. `docs/faq-data.seed.json`. This is the
  source of truth for the first upload only; after that, S3 is authoritative.

### 2. Upload the seed to S3 (one time)

```
aws s3 cp docs/faq-data.seed.json s3://phusd.behodler.io/faq-data.json
```

### 3. Rewrite `FAQ.tsx` to fetch at runtime

Replace the static import with a `fetch('/faq-data.json')` in a `useEffect`, with
loading and error handling. Use the **root-relative** path (leading `/`) — this is a
React Router app, so a bare relative path would resolve against the current route
(`/deposit/faq-data.json`, etc.).

Sketch:
```tsx
import { useEffect, useState } from 'react';
import type { FAQProps, FAQData } from '../../types/vault';
import { parseTextWithLinks } from '../../utils/urlParser';

export default function FAQ({ componentName }: FAQProps) {
  if (!componentName) return null;

  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [allData, setAllData] = useState<Record<string, FAQData> | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/faq-data.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => { if (!cancelled) setAllData(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const faqData = allData?.[componentName];

  // Render nothing on error or until loaded (matches current "no data → null" behavior),
  // or show a lightweight loading/error state — decide per UX preference.
  if (error || !faqData) return null;

  // ...rest of existing render unchanged...
}
```

Notes:
- Fetch the whole map once; index by `componentName` as today. (Multiple FAQ
  instances will each fetch — acceptable for a small static file behind CloudFront;
  optionally hoist into a shared cache/context later.)
- Preserve the existing "no data → render nothing" behavior so nothing breaks if the
  file is briefly unavailable.

### 4. Protect the file in the deploy sync

Update the `deploy` script in `package.json`:
```
yarn build && aws s3 sync dist/build s3://phusd.behodler.io --delete --exclude "faq-data.json" && yarn aws:invalidate
```
`--exclude` drops the key from **both** the upload set and the delete-candidate set,
so the S3 object is never uploaded from the build and never deleted by `--delete`.

## Updating the FAQ after this lands

1. Edit and upload:
   ```
   aws s3 cp faq-data.json s3://phusd.behodler.io/faq-data.json
   ```
2. Invalidate the CloudFront cache for that path so edits appear immediately
   (otherwise stale until TTL):
   ```
   aws cloudfront create-invalidation --distribution-id E1R43V3HMD4UVM --paths '/faq-data.json'
   ```

## Caveats

- **CloudFront caching**: full `yarn deploy` invalidates `/*` and refreshes the FAQ,
  but edits made directly in S3 between deploys need the targeted invalidation above.
- **Availability**: the FAQ now depends on a runtime fetch. The component already
  degrades to rendering nothing when data is missing, so a transient fetch failure is
  non-fatal, but consider a small "couldn't load FAQ" fallback if visibility matters.
- **Schema drift**: since the file is no longer type-checked at build time, keep the
  JSON shape in sync with `FAQData` in `src/types/vault.ts` manually.

## Files Touched

- `src/components/vault/FAQ.tsx` — static import → runtime fetch.
- `src/assets/faq-data.json` — removed (moved to `docs/faq-data.seed.json` as seed).
- `package.json` — add `--exclude "faq-data.json"` to the `deploy` sync.
- S3: `s3://phusd.behodler.io/faq-data.json` — new authoritative copy (uploaded once).

---

## Future: No-Code Admin Editor

Goal: let a non-coder teammate (with admin-page access) edit the FAQ through the UI
instead of hand-editing JSON in the S3 console.

### Threat model (keep it honest)

The **entire blast radius is FAQ content** — worst case, a bad actor or a mistake
defaces or blanks the FAQ. No funds, keys, or contract state are reachable. So the
security bar is "prevent casual/accidental damage and public defacement," not
"protect a treasury." That justifies a *simple* auth scheme — but not *no* auth.

**Key point:** hiding the editor behind the admin tab is **cosmetic only**. Client-side
route gating stops nobody from calling the write endpoint directly. The real control
must live **server-side on the write path**. Every write must independently
authenticate — the UI gate is just UX.

### Recommended shape

Reads stay public (the site already `fetch`es `/faq-data.json`; no auth needed).
Only **writes** need protection.

```
Admin UI (editor)  ──GET──▶  /faq-data.json           (public, existing)
Admin UI (Publish) ──PUT──▶  API Gateway ─▶ Lambda ─▶ validate ─▶ S3 write ─▶ CloudFront invalidate
                                              ▲
                                        checks secret
```

1. **API Gateway + one Lambda** with a single `PUT` (write whole document).
2. **Auth = shared password/token**, held in a **Lambda environment variable**
   (`FAQ_EDITOR_PASSWORD`), **never in the frontend bundle**. The teammate types the
   password into the admin UI; it's sent over HTTPS in an `Authorization` header; the
   Lambda compares it server-side with a timing-safe check. Reject on mismatch. (This
   is adequate *because* the blast radius is FAQ-only. If scope ever grows, swap the
   env var for Secrets Manager — the Lambda already supports `FAQ_SECRET_ARN` — or a
   Cognito login + API Gateway authorizer, same Lambda underneath.)
3. **Server-side validation before writing** — the Lambda re-checks the payload
   against the `FAQData` shape (top-level map of `{ componentName, items: [{title,
   body}] }`). This is what actually protects the live site: a malformed save is
   rejected, not shipped. Do **not** rely on the client for this.
4. **Write + invalidate** — Lambda `PutObject`s to `s3://phusd.behodler.io/faq-data.json`
   then creates a CloudFront invalidation for `/faq-data.json` so the change is live
   immediately.

### Editor UX (client)

Whole-document, edit-in-memory, publish-all — no partial patching:

1. On open, `fetch('/faq-data.json')` into local state.
2. **Dropdown 1 — Tab group** (`MintTab`, `DepositTab`, …): keys of the document.
3. **Dropdown 2 — Item**: the `items[]` of the selected group, labelled by `title`.
4. Selecting an item fills two fields: **Title** (header) and **Body** (message).
5. **CRUD controls**: add/delete item within a group, edit title/body, reorder
   (optional). Everything mutates the in-memory copy only.
6. **Publish** button → `PUT` the entire edited document to the Lambda. On success,
   show confirmation; the CloudFront invalidation makes it live within seconds.

Single teammate → no concurrent-edit locking needed. If that ever changes, add an
ETag/If-Match check in the Lambda.

### Why not the alternatives

- **Direct browser → S3 write (Cognito Identity Pool):** removes the Lambda but needs
  scoped IAM + Cognito setup, and you lose the server-side validation choke point.
  More moving parts for no real gain at this scale.
- **Just edit JSON in the S3 console:** free, but error-prone for a non-coder — one
  bad comma blanks the FAQ. The Lambda's validation is the main reason to build UI.

### Build checklist

- [x] Lambda: `PUT` handler — auth check → schema validate → `PutObject` → CloudFront
      invalidation. Secret in Secrets Manager **or** `FAQ_EDITOR_PASSWORD` env.
      → `lambda/index.js` (+ `package.json`, `README.md`). `npm run build` → `function.zip`.
- [x] Admin editor component: two dropdowns + title/body fields + CRUD + Publish.
      → `src/components/vault/FAQEditor.tsx`, rendered inside `src/components/vault/Admin.tsx`.
- [x] Password prompt in the admin UI (session-scoped state, never persisted/bundled).
- [x] Client + server schema validation; success/error toasts.
- [x] **Deploy the Lambda** behind an **API Gateway HTTP API**. One-step:
      `cd lambda && export FAQ_EDITOR_PASSWORD=… && ./deploy.sh` (creates the IAM
      role, function, env vars, and HTTP API; prints the endpoint). See
      `lambda/README.md` for details and the manual path.
      → Endpoint live: `https://hngbq8pbff.execute-api.us-east-1.amazonaws.com/`
- [x] **Set `VITE_FAQ_API_URL`** to the endpoint and rebuild the UI. Added to
      `.envrc` (gitignored); rebuild with `yarn build && yarn deploy`.
- [ ] Keep a **manual backup copy** of the current `faq-data.json` (e.g.
      `docs/faq-data.seed.json`, already in the repo) so a bad edit can be reverted by
      re-uploading it. (Bucket versioning intentionally left off.)

### Wiring the endpoint into the UI

The editor reads the write endpoint from `import.meta.env.VITE_FAQ_API_URL` at build
time. Until it's set, the editor loads and previews content but disables Publish
(shows a "not configured" notice). To enable publishing, set the var (e.g. in
`.envrc`/`.env` or the build environment) and run `yarn build`:

```bash
# API Gateway HTTP API endpoint — trailing slash, no stage path ($default stage):
export VITE_FAQ_API_URL="https://<api-id>.execute-api.<region>.amazonaws.com/"
```

> **Why API Gateway, not a Lambda Function URL?** We originally chose a Function
> URL for simplicity, but this AWS account is in an Organization whose policy
> blocks public (Auth type `NONE`) function URLs — they return 403 regardless of
> the resource policy, and a member account can't override the org policy. API
> Gateway HTTP API is a different resource type not covered by that guardrail. The
> in-code password is still the real gate; CORS is handled by the Lambda (the
> `$default` route forwards `OPTIONS` to it), so no CORS config is set on the API.

Reads stay on the public `/faq-data.json`; only Publish uses this endpoint.

### Files added for the editor

- `src/components/vault/FAQEditor.tsx` — the admin editor (fetch → edit → PUT).
- `src/components/vault/Admin.tsx` — renders `<FAQEditor />`.
- `lambda/` — self-contained Node package for the write endpoint (`index.js`,
  `package.json`, `README.md`, `.gitignore`). `cd lambda && npm run build`.
