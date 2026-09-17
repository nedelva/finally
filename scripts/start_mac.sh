#!/usr/bin/env bash
# Build (if needed) and run the FinAlly Docker container.
# Idempotent: safe to run multiple times. Pass --build to force a rebuild.
set -euo pipefail

IMAGE_NAME="finally:latest"
CONTAINER_NAME="finally-app"
VOLUME_NAME="finally-data"
PORT="8000"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

FORCE_BUILD="false"
for arg in "$@"; do
  case "${arg}" in
    --build)
      FORCE_BUILD="true"
      ;;
  esac
done

# --- .env handling -----------------------------------------------------
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_ARGS=()
if [[ -f "${ENV_FILE}" ]]; then
  ENV_ARGS=(--env-file "${ENV_FILE}")
else
  echo "Warning: no .env file found at ${ENV_FILE}."
  echo "  Create one with:  cp .env.example .env   (then add your OPENROUTER_API_KEY)"
  echo "  Continuing without it — the AI chat feature will not work until OPENROUTER_API_KEY is set."
fi

# --- Build image if missing or --build passed --------------------------
if [[ "${FORCE_BUILD}" == "true" ]] || ! docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
  echo "Building Docker image ${IMAGE_NAME}..."
  docker build -t "${IMAGE_NAME}" "${PROJECT_ROOT}"
else
  echo "Docker image ${IMAGE_NAME} already exists (use --build to force a rebuild)."
fi

# --- Remove any existing container with the same name -------------------
if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  echo "Removing existing container ${CONTAINER_NAME}..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

# --- Run --------------------------------------------------------------
echo "Starting ${CONTAINER_NAME}..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${PORT}:8000" \
  -v "${VOLUME_NAME}:/app/db" \
  "${ENV_ARGS[@]+"${ENV_ARGS[@]}"}" \
  "${IMAGE_NAME}" >/dev/null

echo ""
echo "FinAlly is starting at http://localhost:${PORT}"

# Optionally open the browser (best-effort; never fail the script if unavailable).
if command -v open >/dev/null 2>&1; then
  open "http://localhost:${PORT}" >/dev/null 2>&1 || true
fi
