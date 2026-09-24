#!/usr/bin/env bash
# Idempotent macOS/Linux launcher for FinAlly (PLAN.md section 11).
#
# Builds the image if absent (or when --build is passed), starts the
# container if it exists but is stopped, creates it if it does not exist
# yet, and blocks until the app actually answers /api/health before
# printing the ready message. Safe to run repeatedly: an already-running
# container is a no-op success.
set -euo pipefail

CONTAINER_NAME="finally"
IMAGE_NAME="finally"
VOLUME_NAME="finally-data"

cd "$(dirname "$0")/.."

if [[ "${1:-}" == "--build" ]] || ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  docker build -t "$IMAGE_NAME" .
fi

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  : # already running - fall through to the readiness gate and ready message
elif docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  docker start "$CONTAINER_NAME" >/dev/null
else
  docker run -d --name "$CONTAINER_NAME" \
    -v "$VOLUME_NAME":/app/db \
    -p 8000:8000 --env-file .env "$IMAGE_NAME" >/dev/null
fi

# Readiness gate: never announce success against a container that is still
# booting, or that booted degraded. Poll for up to ~90 seconds.
READY=0
for _ in $(seq 1 90); do
  if curl -fsS http://localhost:8000/api/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "$READY" -ne 1 ]]; then
  echo "FinAlly did not become ready within 90 seconds. Check 'docker logs $CONTAINER_NAME' for details." >&2
  exit 1
fi

echo "FinAlly running at http://localhost:8000"
