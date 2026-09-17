"""Health check route: GET /api/health."""

from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["system"])


@router.get("/api/health")
async def get_health() -> dict[str, str]:
    return {"status": "ok"}
