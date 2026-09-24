#!/usr/bin/env bash
# Idempotent macOS/Linux stopper for FinAlly (PLAN.md section 11).
#
# Stops and removes the "finally" container only. Deliberately never issues
# any Docker subcommand that deletes or recreates the "finally-data" named
# volume - OPS-02 requires that stopping (repeatedly, in any order) never
# destroys the operator's trades, watchlist, or chat history.
set -euo pipefail

CONTAINER_NAME="finally"

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
  echo "FinAlly stopped."
else
  echo "FinAlly is not running."
fi
