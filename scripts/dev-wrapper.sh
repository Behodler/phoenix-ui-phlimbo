#!/bin/bash
# Wrapper script to ensure .envrc is loaded before starting dev environment

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load .envrc from project root if it exists
if [ -f "$PROJECT_ROOT/.envrc" ]; then
  echo "Loading environment from .envrc..."
  source "$PROJECT_ROOT/.envrc"
else
  echo "WARNING: No .envrc file found in $PROJECT_ROOT"
  echo "Please create .envrc with: export DEPLOYMENT_SERVER_PATH=~/code/reflax-mint/deployment-staging"
fi

# Now run the actual start script
exec bash "$SCRIPT_DIR/start-deployment-server.sh"
