'use strict';

/**
 * FAQ write Lambda.
 *
 * Accepts an authenticated PUT of the entire faq-data.json document, validates
 * it, writes it to S3, and invalidates the CloudFront path so the change goes
 * live within seconds.
 *
 * Threat model: the only thing reachable here is FAQ content. Auth is therefore
 * a single shared password (checked with a timing-safe compare), which is
 * proportionate. The important guarantee is server-side validation: a malformed
 * document is rejected here, never written, so a bad edit can't blank the live
 * FAQ. Do not rely on the browser for that check.
 *
 * Works behind an API Gateway HTTP API OR a Lambda Function URL (both expose the
 * method at requestContext.http.method); also falls back to REST API's
 * httpMethod. Handles the CORS preflight (OPTIONS) itself.
 *
 * Required env vars:
 *   BUCKET             - target S3 bucket (e.g. phusd.behodler.io)
 *   OBJECT_KEY         - object key (default: faq-data.json)
 *   ALLOWED_ORIGIN     - CORS origin to reflect (e.g. https://phusd.behodler.io); default '*'
 * Auth (one of):
 *   FAQ_EDITOR_PASSWORD - shared password, OR
 *   FAQ_SECRET_ARN      - Secrets Manager ARN holding the password (plaintext or {"password":"…"})
 * Optional:
 *   DISTRIBUTION_ID    - CloudFront distribution to invalidate (skips invalidation if unset)
 *   INVALIDATION_PATH  - path to invalidate (default: /faq-data.json)
 */

const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const {
  CloudFrontClient,
  CreateInvalidationCommand,
} = require('@aws-sdk/client-cloudfront');
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

const REGION = process.env.AWS_REGION || 'us-east-1';
const s3 = new S3Client({ region: REGION });
const cloudfront = new CloudFrontClient({ region: REGION });
const secrets = new SecretsManagerClient({ region: REGION });

// Cache the resolved password across warm invocations.
let cachedPassword = null;

async function resolvePassword() {
  if (cachedPassword !== null) return cachedPassword;
  if (process.env.FAQ_SECRET_ARN) {
    const out = await secrets.send(
      new GetSecretValueCommand({ SecretId: process.env.FAQ_SECRET_ARN }),
    );
    const raw = out.SecretString || '';
    try {
      const parsed = JSON.parse(raw);
      cachedPassword = parsed.password || parsed.FAQ_EDITOR_PASSWORD || raw;
    } catch (_) {
      cachedPassword = raw;
    }
  } else {
    cachedPassword = process.env.FAQ_EDITOR_PASSWORD || '';
  }
  return cachedPassword;
}

// Constant-time string comparison that first equalizes length to avoid leaking
// it via early return.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) {
    // Still run a comparison to keep timing roughly constant.
    crypto.timingSafeEqual(ab, ab);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

// Authoritative server-side validation. Mirrors the client's checks; this is the
// one that actually protects the live site. Returns an error string or null.
function validateDoc(doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return 'Payload must be a JSON object keyed by tab group.';
  }
  const groups = Object.keys(doc);
  if (groups.length === 0) return 'Document has no tab groups.';
  for (const key of groups) {
    const block = doc[key];
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      return `Group "${key}" is malformed.`;
    }
    if (block.componentName !== key) {
      return `Group "${key}" has a mismatched componentName ("${block.componentName}").`;
    }
    if (!Array.isArray(block.items)) return `Group "${key}" has no items array.`;
    for (let i = 0; i < block.items.length; i++) {
      const item = block.items[i];
      if (!item || typeof item !== 'object') return `Item ${i + 1} in "${key}" is malformed.`;
      if (typeof item.title !== 'string' || typeof item.body !== 'string') {
        return `Item ${i + 1} in "${key}" must have string title and body.`;
      }
      if (!item.title.trim()) return `Item ${i + 1} in "${key}" has an empty title.`;
      if (!item.body.trim()) return `"${item.title}" in "${key}" has an empty body.`;
      // Reject unexpected keys so the shape stays exactly {title, body}.
      const extra = Object.keys(item).filter((k) => k !== 'title' && k !== 'body');
      if (extra.length) return `Item ${i + 1} in "${key}" has unexpected field(s): ${extra.join(', ')}.`;
    }
  }
  return null;
}

function corsHeaders() {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function response(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(bodyObj),
  };
}

function getMethod(event) {
  return (
    event?.requestContext?.http?.method || // HTTP API / Function URL
    event?.httpMethod || // REST API
    'UNKNOWN'
  );
}

function getHeader(event, name) {
  const headers = event?.headers || {};
  const lower = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) return headers[k];
  }
  return undefined;
}

function getBearerToken(event) {
  const auth = getHeader(event, 'authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return m ? m[1].trim() : '';
}

exports.handler = async (event) => {
  const method = getMethod(event);

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }

  if (method !== 'PUT') {
    return response(405, { error: 'Method not allowed. Use PUT.' });
  }

  // --- Auth ---
  const expected = await resolvePassword();
  if (!expected) {
    return response(500, { error: 'Server auth not configured.' });
  }
  const token = getBearerToken(event);
  if (!token || !safeEqual(token, expected)) {
    return response(401, { error: 'Unauthorized.' });
  }

  // --- Parse ---
  let raw = event.body || '';
  if (event.isBase64Encoded) {
    raw = Buffer.from(raw, 'base64').toString('utf8');
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (_) {
    return response(400, { error: 'Body is not valid JSON.' });
  }

  // --- Validate (authoritative) ---
  const validationError = validateDoc(doc);
  if (validationError) {
    return response(422, { error: validationError });
  }

  const bucket = process.env.BUCKET;
  const key = process.env.OBJECT_KEY || 'faq-data.json';
  if (!bucket) {
    return response(500, { error: 'BUCKET not configured.' });
  }

  // --- Write ---
  // Re-serialize from the parsed+validated object (never echo raw bytes) and
  // set a short cache TTL so edits propagate quickly even without invalidation.
  const outBody = JSON.stringify(doc, null, 2);
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: outBody,
        ContentType: 'application/json',
        CacheControl: 'public, max-age=60',
      }),
    );
  } catch (err) {
    console.error('S3 PutObject failed:', err);
    return response(502, { error: 'Failed to write to storage.' });
  }

  // --- Invalidate CloudFront (best-effort) ---
  let invalidated = false;
  if (process.env.DISTRIBUTION_ID) {
    const path = process.env.INVALIDATION_PATH || '/faq-data.json';
    try {
      await cloudfront.send(
        new CreateInvalidationCommand({
          DistributionId: process.env.DISTRIBUTION_ID,
          InvalidationBatch: {
            CallerReference: `faq-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            Paths: { Quantity: 1, Items: [path] },
          },
        }),
      );
      invalidated = true;
    } catch (err) {
      // Non-fatal: the write already succeeded; the edge copy will refresh on TTL.
      console.error('CloudFront invalidation failed:', err);
    }
  }

  return response(200, {
    ok: true,
    bucket,
    key,
    bytes: Buffer.byteLength(outBody),
    invalidated,
  });
};
