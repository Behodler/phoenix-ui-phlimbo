#!/usr/bin/env bash
set -euo pipefail
DIST_ID=E1R43V3HMD4UVM
ID=$(aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths '/*' --query 'Invalidation.Id' --output text)
aws cloudfront wait invalidation-completed --distribution-id "$DIST_ID" --id "$ID"
echo "Done: $ID"
