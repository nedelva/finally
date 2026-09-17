# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: build the Next.js frontend (static export -> frontend/out/)
# ---------------------------------------------------------------------------
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

# Install dependencies first for better layer caching.
COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Python backend, serving the API + the built frontend as static files
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS backend

# curl is needed for the HEALTHCHECK below.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package/project manager) via the official static binary.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# NOTE on layout: the backend's DB path logic (backend/app/db/connection.py) resolves the
# default SQLite path as three directories above itself, i.e. `<project_root>/db/finally.db`
# where <project_root> is the parent of the `backend/` directory. To keep that resolution
# consistent with the documented volume mount target (`/app/db`, see PLAN.md §11 and
# docker-compose.yml), we preserve the `backend/` subdirectory under `/app` rather than
# flattening its contents into `/app` directly:
#
#   /app/db/finally.db                 <- volume mount target, matches PLAN.md
#   /app/backend/app/db/connection.py  <- three parents up from here is /app
#
# This must stay consistent with API_CONTRACT.md's "Static frontend serving" section, which
# expects the built frontend at `backend/static/` (i.e. `/app/backend/static` in the image).
WORKDIR /app/backend

# Install dependencies first for better layer caching, WITHOUT installing the project itself
# (the project's own package, "app", doesn't exist in the build context yet at this point).
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

# Now copy the rest of the backend source and install the project itself.
COPY backend/ ./
RUN uv sync --frozen --no-dev

# Copy the built frontend static export into the path backend/app/main.py expects to mount.
COPY --from=frontend-builder /frontend/out ./static

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# --frozen avoids uv re-resolving/re-checking the lockfile against the network at container
# start; dependencies were already fully installed at build time above.
CMD ["uv", "run", "--frozen", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
