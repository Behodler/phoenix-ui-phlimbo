#!/usr/bin/env bash
#
# Idempotent deploy for the history indexer Lambda + its 12-hour schedule.
#
# Safe to re-run. First run creates: the Lambda execution role, the function,
# the EventBridge Scheduler role and the schedule. Later runs update the code,
# configuration, policies and schedule in place.
#
# Creates/updates ONLY resources named phusd-history-*. Never touches faq-write,
# its role/API, or anything else.
#
# Usage:
#   ./deploy.sh
#
set -euo pipefail

# ----- Config (override via env) ---------------------------------------------
REGION="${REGION:-us-east-1}"                 # bucket is in us-east-1
BUCKET="${BUCKET:-phusd.behodler.io}"
OBJECT_KEY="${OBJECT_KEY:-history.json}"
FUNCTION_NAME="${FUNCTION_NAME:-phusd-history-indexer}"
ROLE_NAME="${ROLE_NAME:-phusd-history-indexer-role}"
SCHEDULER_ROLE_NAME="${SCHEDULER_ROLE_NAME:-phusd-history-scheduler-role}"
SCHEDULE_NAME="${SCHEDULE_NAME:-phusd-history-indexer-12h}"
SCHEDULE_EXPRESSION="${SCHEDULE_EXPRESSION:-rate(12 hours)}"
RUNTIME="${RUNTIME:-nodejs22.x}"
ARCH="${ARCH:-arm64}"
MEMORY="${MEMORY:-256}"
TIMEOUT="${TIMEOUT:-300}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-14}"
RPC_URLS="${RPC_URLS:-https://eth.drpc.org,https://mainnet.gateway.tenderly.co,https://ethereum-rpc.publicnode.com}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# -----------------------------------------------------------------------------

echo "==> Account / identity"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "    account: ${ACCOUNT_ID}  region: ${REGION}"
FUNCTION_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"

# ----- Build the zip ---------------------------------------------------------
echo "==> Building function.zip"
( cd "$HERE" && npm run build )
ZIP="fileb://${HERE}/function.zip"

# ----- Lambda execution role -------------------------------------------------
echo "==> IAM role: ${ROLE_NAME}"
NEW_ROLE=0
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
  NEW_ROLE=1
  echo "    created role"
else
  echo "    role exists"
fi

aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole >/dev/null

# Least privilege: read/write the one object; ListBucket only for that key so a
# missing object yields 404 (NoSuchKey) instead of 403.
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name phusd-history-s3-access \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Action\": [\"s3:GetObject\", \"s3:PutObject\"],
        \"Resource\": \"arn:aws:s3:::${BUCKET}/${OBJECT_KEY}\"
      },
      {
        \"Effect\": \"Allow\",
        \"Action\": \"s3:ListBucket\",
        \"Resource\": \"arn:aws:s3:::${BUCKET}\",
        \"Condition\": {\"StringEquals\": {\"s3:prefix\": [\"${OBJECT_KEY}\"]}}
      }
    ]
  }" >/dev/null
echo "    policies attached"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

ENV_JSON="{\"Variables\":{\"BUCKET\":\"${BUCKET}\",\"OBJECT_KEY\":\"${OBJECT_KEY}\",\"RPC_URLS\":\"${RPC_URLS}\"}}"

# ----- Function (create or update) -------------------------------------------
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "==> Updating existing function code + config"
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" --region "$REGION" \
    --architectures "$ARCH" \
    --zip-file "$ZIP" >/dev/null
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" --region "$REGION" \
    --runtime "$RUNTIME" \
    --handler index.handler \
    --role "$ROLE_ARN" \
    --environment "$ENV_JSON" \
    --timeout "$TIMEOUT" --memory-size "$MEMORY" >/dev/null
else
  if [[ "$NEW_ROLE" == 1 ]]; then
    echo "==> Waiting for the new role to propagate"
    sleep 10
  fi
  echo "==> Creating function"
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" --region "$REGION" \
    --runtime "$RUNTIME" \
    --architectures "$ARCH" \
    --handler index.handler \
    --role "$ROLE_ARN" \
    --zip-file "$ZIP" \
    --environment "$ENV_JSON" \
    --timeout "$TIMEOUT" --memory-size "$MEMORY" >/dev/null
fi
aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"

# Exactly one run at a time: an overlapping run could read a stale doc.
aws lambda put-function-concurrency \
  --function-name "$FUNCTION_NAME" --region "$REGION" \
  --reserved-concurrent-executions 1 >/dev/null
echo "    function ready (reserved concurrency 1)"

# ----- Log retention ---------------------------------------------------------
LOG_GROUP="/aws/lambda/${FUNCTION_NAME}"
aws logs create-log-group --log-group-name "$LOG_GROUP" --region "$REGION" >/dev/null 2>&1 || true
aws logs put-retention-policy \
  --log-group-name "$LOG_GROUP" --region "$REGION" \
  --retention-in-days "$LOG_RETENTION_DAYS"
echo "==> Log group ${LOG_GROUP}: ${LOG_RETENTION_DAYS}-day retention"

# ----- Scheduler role --------------------------------------------------------
echo "==> IAM role: ${SCHEDULER_ROLE_NAME}"
NEW_SCHED_ROLE=0
if ! aws iam get-role --role-name "$SCHEDULER_ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "$SCHEDULER_ROLE_NAME" \
    --assume-role-policy-document "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [{
        \"Effect\": \"Allow\",
        \"Principal\": {\"Service\": \"scheduler.amazonaws.com\"},
        \"Action\": \"sts:AssumeRole\",
        \"Condition\": {\"StringEquals\": {\"aws:SourceAccount\": \"${ACCOUNT_ID}\"}}
      }]
    }" >/dev/null
  NEW_SCHED_ROLE=1
  echo "    created role"
else
  echo "    role exists"
fi
aws iam put-role-policy \
  --role-name "$SCHEDULER_ROLE_NAME" \
  --policy-name phusd-history-invoke \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": \"lambda:InvokeFunction\",
      \"Resource\": [\"${FUNCTION_ARN}\", \"${FUNCTION_ARN}:*\"]
    }]
  }" >/dev/null
SCHEDULER_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${SCHEDULER_ROLE_NAME}"
if [[ "$NEW_SCHED_ROLE" == 1 ]]; then
  echo "    waiting for the new role to propagate"
  sleep 10
fi

# ----- Schedule (create or update) -------------------------------------------
TARGET_JSON="{\"Arn\":\"${FUNCTION_ARN}\",\"RoleArn\":\"${SCHEDULER_ROLE_ARN}\",\"RetryPolicy\":{\"MaximumRetryAttempts\":0}}"
if aws scheduler get-schedule --name "$SCHEDULE_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws scheduler update-schedule \
    --name "$SCHEDULE_NAME" --region "$REGION" \
    --schedule-expression "$SCHEDULE_EXPRESSION" \
    --flexible-time-window Mode=OFF \
    --target "$TARGET_JSON" >/dev/null
  echo "==> Schedule ${SCHEDULE_NAME} updated (${SCHEDULE_EXPRESSION})"
else
  aws scheduler create-schedule \
    --name "$SCHEDULE_NAME" --region "$REGION" \
    --schedule-expression "$SCHEDULE_EXPRESSION" \
    --flexible-time-window Mode=OFF \
    --target "$TARGET_JSON" >/dev/null
  echo "==> Schedule ${SCHEDULE_NAME} created (${SCHEDULE_EXPRESSION})"
fi

echo
echo "============================================================"
echo "Deployed ${FUNCTION_NAME}."
echo "Invoke now (e.g. to drive the initial backfill):"
echo "  aws lambda invoke --function-name ${FUNCTION_NAME} --region ${REGION} \\"
echo "    --cli-read-timeout 360 /dev/stdout"
echo "Published at: https://phoenixdefi.app/${OBJECT_KEY}"
echo "============================================================"
