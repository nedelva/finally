# syntax=docker/dockerfile:1
#
# FinAlly — single-port, two-stage image (PLAN.md section 11).
#
# Stage 1 builds the Next.js static export. Stage 2 installs the FastAPI
# backend and serves both the API and the static export from one uvicorn
# process on port 8000. Exactly two stages — do not add a third
# image-slimming stage (locked by PLAN.md section 11).
#
# The backend/ subdirectory nesting is preserved under /app/backend/ rather
# than flattened into /app/, because backend/app/db/connection.py resolves
# its repo root via Path(__file__).resolve().parents[3], and
# backend/app/main.py resolves its backend/repo dirs via parents[1]/parents[2].
# Flattening would silently break both computations — see 05-RESEARCH.md
# Pattern 1.

FROM node:20-slim AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM ghcr.io/astral-sh/uv:python3.12-trixie-slim
RUN groupadd --system --gid 999 nonroot \
 && useradd --system --gid 999 --uid 999 --create-home nonroot
WORKDIR /app
ENV PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

# Install dependencies before copying source, so this layer caches
# independently of application-code changes.
COPY backend/pyproject.toml backend/uv.lock /app/backend/
RUN cd /app/backend && uv sync --locked --no-install-project

# Preserve the backend/ nesting — never flatten into /app/.
COPY backend/ /app/backend/
COPY --from=frontend-builder /build/frontend/out /app/backend/static

# Build-time assertion: a botched static copy would otherwise yield a
# container that answers /api/health with 200 while serving zero UI, because
# resolve_static_dir() only logs a warning when it finds nothing.
RUN test -f /app/backend/static/index.html

RUN cd /app/backend && uv sync --locked

# Build-time assertions that the real path-resolution functions compute the
# expected container paths, with the escape-hatch env vars explicitly
# unset. This proves the parents[N] arithmetic against the actual image
# layout rather than trivially passing under the ENV pins set below.
#
# Both the `cd` and the absolute interpreter path are load-bearing: WORKDIR
# is still /app here (where `app/` is not importable — the package lives at
# /app/backend/app), and PATH has not yet been extended, so a bare `python`
# would be the base image's interpreter without fastapi/pydantic installed.
RUN cd /app/backend && env -u FINALLY_DB_PATH -u FINALLY_STATIC_DIR \
    /app/backend/.venv/bin/python -c \
    "from app.db.connection import get_db_path; \
assert str(get_db_path()) == '/app/db/finally.db', get_db_path()"

RUN cd /app/backend && env -u FINALLY_DB_PATH -u FINALLY_STATIC_DIR \
    /app/backend/.venv/bin/python -c \
    "from app.main import resolve_static_dir; \
assert str(resolve_static_dir()) == '/app/backend/static', resolve_static_dir()"

# Docker seeds a brand-new named volume from the image directory's contents
# and ownership. This must happen before USER nonroot, or a root-owned
# /app/db makes the first SQLite write fail under the non-root process.
RUN mkdir -p /app/db && chown -R nonroot:nonroot /app/db /app/backend

ENV PATH="/app/backend/.venv/bin:$PATH"
ENV FINALLY_DB_PATH=/app/db/finally.db
ENV FINALLY_STATIC_DIR=/app/backend/static

USER nonroot
WORKDIR /app/backend
EXPOSE 8000

# The slim images ship no curl; a Python one-liner avoids growing the image
# purely for a healthcheck.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
