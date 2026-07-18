#!/usr/bin/env bash
# Bring up PostgreSQL schema on a remote host without Docker.
# Prerequisites: PostgreSQL installed and running; Node 20+; repo checked out.
#
# Usage:
#   cp .env.example .env   # edit DATABASE_URL + PG_ADMIN_URL
#   chmod +x scripts/db-setup.sh
#   ./scripts/db-setup.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy from .env.example and set DATABASE_URL / PG_ADMIN_URL"
  exit 1
fi

if ! command -v node >/dev/null; then
  echo "Node.js is required"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm ci
fi

npm run db:setup
echo "Done. Start the app with: npm run build && npm run preview -- --host 0.0.0.0"
