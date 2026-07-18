# Plan: Externalize `faq-data.json` for Rebuild-Free Updates

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
