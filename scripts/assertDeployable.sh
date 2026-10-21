#!/usr/bin/env bash
set -euo pipefail
# Refuse to deploy from anything but the master branch of the main checkout.
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "master" ]; then
  echo "Refusing to deploy: on branch '$BRANCH', not master." >&2
  exit 1
fi
if [ "$(git rev-parse --absolute-git-dir)" != "$(cd "$(git rev-parse --git-common-dir)" && pwd)" ]; then
  echo "Refusing to deploy: $(pwd) is a git worktree, not the main checkout." >&2
  exit 1
fi
