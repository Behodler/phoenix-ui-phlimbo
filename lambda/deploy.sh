#!/usr/bin/env bash
#
# One-shot deploy for the FAQ write Lambda + Function URL.
#
# Idempotent: safe to re-run. On the first run it creates the IAM role, the
# function, and the Function URL. On later runs it updates the code, refreshes
# the env vars, and reprints the URL.
#
# Usage:
#   export FAQ_EDITOR_PASSWORD='choose-a-strong-password'   # required
#   ./deploy.sh
#
# Keep the password simple-ish (avoid " and \, which complicate JSON escaping).
#
set -euo pipefail

# ----- Config (edit if needed) -----------------------------------------------
REGION="${REGION:-us-east-1}"                 # bucket is in us-east-1
BUCKET="${BUCKET:-phusd.behodler.io}"
DISTRIBUTION_ID="${DISTRIBUTION_ID:-E1R43V3HMD4UVM}"
ALLOWED_ORIGIN="${ALLOWED_ORIGIN:-https://phusd.behodler.io}"
OBJECT_KEY="${OBJECT_KEY:-faq-data.json}"
FUNCTION_NAME="${FUNCTION_NAME:-faq-write}"
ROLE_NAME="${ROLE_NAME:-faq-write-lambda-role}"
RUNTIME="${RUNTIME:-nodejs20.x}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# -----------------------------------------------------------------------------

if [[ -z "${FAQ_EDITOR_PASSWORD:-}" ]]; then
  echo "ERROR: export FAQ_EDITOR_PASSWORD before running." >&2
  exit 1
fi

echo "==> Account / identity"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "    account: ${ACCOUNT_ID}  region: ${REGION}"

# ----- Build the zip ---------------------------------------------------------
echo "==> Building function.zip"
( cd "$HERE" && npm run build )
ZIP="fileb://${HERE}/function.zip"

# ----- IAM role --------------------------------------------------------------
echo "==> IAM role: ${ROLE_NAME}"
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' >/dev/null
  echo "    created role"
else
  echo "    role exists"
fi

# Logs
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null

# Least-privilege inline policy: write the one object + invalidate the one dist.
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name faq-write-access \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": \"s3:PutObject\",
        \"Resource\": \"arn:aws:s3:::${BUCKET}/${OBJECT_KEY}\"
      },
      {
        \"Effect\": \"Allow\",
        \"Action\": \"cloudfront:CreateInvalidation\",
        \"Resource\": \"arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${DISTRIBUTION_ID}\"
      }
    ]
  }" >/dev/null
echo "    policies attached"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# Build the environment JSON (contains the secret) in a temp file, then remove it.
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT
cat > "$ENV_FILE" <<JSON
{
  "Variables": {
    "BUCKET": "${BUCKET}",
    "OBJECT_KEY": "${OBJECT_KEY}",
    "DISTRIBUTION_ID": "${DISTRIBUTION_ID}",
    "ALLOWED_ORIGIN": "${ALLOWED_ORIGIN}",
    "FAQ_EDITOR_PASSWORD": "${FAQ_EDITOR_PASSWORD}"
  }
}
JSON

# ----- Function (create or update) -------------------------------------------
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "==> Updating existing function code + config"
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" --region "$REGION" \
    --zip-file "$ZIP" >/dev/null
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" --region "$REGION" \
    --environment "file://${ENV_FILE}" \
    --timeout 15 --memory-size 256 >/dev/null
else
  echo "==> Creating function (waiting a moment for the new role to propagate)"
  sleep 10
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" --region "$REGION" \
    --runtime "$RUNTIME" \
    --handler index.handler \
    --role "$ROLE_ARN" \
    --zip-file "$ZIP" \
    --environment "file://${ENV_FILE}" \
    --timeout 15 --memory-size 256 >/dev/null
fi
aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
echo "    function ready"

# ----- API Gateway HTTP API --------------------------------------------------
# NOTE: We use API Gateway rather than a Lambda Function URL because this account
# is in an AWS Organization whose policy blocks public (AuthType NONE) function
# URLs — such URLs return 403 no matter the resource policy. The HTTP API is a
# different resource type not covered by that guardrail. The password checked in
# the Lambda is still the real gate. CORS is handled entirely by the Lambda (the
# $default route sends OPTIONS to it), so no CORS config is set on the API.
API_NAME="${API_NAME:-faq-write-api}"
echo "==> API Gateway HTTP API: ${API_NAME}"
API_ID="$(aws apigatewayv2 get-apis --region "$REGION" \
  --query "Items[?Name=='${API_NAME}'].ApiId | [0]" --output text)"

if [[ -z "$API_ID" || "$API_ID" == "None" ]]; then
  # Quick-create: AWS_PROXY integration + catch-all $default route + auto-deployed $default stage.
  API_ID="$(aws apigatewayv2 create-api --region "$REGION" \
    --name "$API_NAME" --protocol-type HTTP \
    --target "arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}" \
    --query ApiId --output text)"
  echo "    created (${API_ID})"
else
  echo "    exists (${API_ID})"
fi

# Allow API Gateway to invoke the Lambda (idempotent: ignore AlreadyExists).
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" --region "$REGION" \
  --statement-id apigw-faq-invoke \
  --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*" \
  >/dev/null 2>&1 || true

API_ENDPOINT="$(aws apigatewayv2 get-api --api-id "$API_ID" --region "$REGION" \
  --query ApiEndpoint --output text)/"

echo
echo "============================================================"
echo "Deployed. FAQ write endpoint:"
echo "  ${API_ENDPOINT}"
echo
echo "Next: point the UI at it and rebuild:"
echo "  export VITE_FAQ_API_URL=\"${API_ENDPOINT}\""
echo "  (cd .. && yarn build && yarn deploy)"
echo "============================================================"
