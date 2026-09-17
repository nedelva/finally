#!/usr/bin/env bash
# Stop and remove the running FinAlly container. Does NOT remove the data volume.
# Idempotent: safe to run multiple times, even if the container isn't running.
set -euo pipefail

CONTAINER_NAME="finally-app"

if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  echo "Stopping and removing container ${CONTAINER_NAME}..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null
  echo "Done. (The 'finally-data' volume was preserved.)"
else
  echo "No container named ${CONTAINER_NAME} found. Nothing to do."
fi
