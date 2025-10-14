#!/bin/bash
# Start the deployment server from the configured directory
# This script handles working directory changes and environment loading

set -e

# Check if DEPLOYMENT_SERVER_PATH is set
if [ -z "$DEPLOYMENT_SERVER_PATH" ]; then
  echo "ERROR: DEPLOYMENT_SERVER_PATH is not set"
  echo "Please create a .envrc file with:"
  echo "  export DEPLOYMENT_SERVER_PATH=~/code/reflax-mint/deployment-staging"
  echo "Then source it: source .envrc"
  exit 1
fi

# Expand tilde in path
DEPLOYMENT_SERVER_PATH="${DEPLOYMENT_SERVER_PATH/#\~/$HOME}"

# Check if directory exists
if [ ! -d "$DEPLOYMENT_SERVER_PATH" ]; then
  echo "ERROR: Deployment server directory not found: $DEPLOYMENT_SERVER_PATH"
  echo "Please ensure the path in .envrc points to a valid directory"
  exit 1
fi

# Check if package.json exists
if [ ! -f "$DEPLOYMENT_SERVER_PATH/package.json" ]; then
  echo "ERROR: No package.json found in: $DEPLOYMENT_SERVER_PATH"
  echo "This doesn't appear to be a valid deployment server directory"
  exit 1
fi

echo "Starting deployment server from: $DEPLOYMENT_SERVER_PATH"

# Change to deployment server directory and run dev script
# Source .envrc if it exists to load deployment server environment
cd "$DEPLOYMENT_SERVER_PATH"
if [ -f .envrc ]; then
  source .envrc
fi

# Use npm dev command from deployment server
npm run dev
