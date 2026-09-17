"""Tests for `app.main`: the FastAPI app wiring, snapshot recording, and startup lifecycle.

Unlike the other `tests/api` modules, these import the real `app.main` module (not a
router-only test app) to exercise the lifespan startup logic directly.
"""

from fastapi.testclient import TestClient

from app.db import apply_buy, get_snapshots
from app.market import PriceCache


def test_record_snapshot_writes_a_row(temp_db):
    from app.main import record_snapshot

    cache = PriceCache()
    record_snapshot(cache)

    snapshots = get_snapshots()
    assert len(snapshots) == 1
    assert snapshots[0]["total_value"] == 10000.0


def test_lifespan_records_immediate_snapshot_and_tracks_held_positions(temp_db):
    # A position in a ticker that is NOT on the default watchlist -- proves the startup ticker
    # set is the union of watchlist ∪ positions, not just the watchlist.
    apply_buy("PYPL", 1, 10.0)

    from app.main import app

    with TestClient(app):
        tickers = app.state.market_data_source.get_tickers()
        assert "PYPL" in tickers  # held position, off the watchlist
        assert "AAPL" in tickers  # still-seeded watchlist ticker

        # GET /api/portfolio/history shouldn't be empty right after boot.
        snapshots = get_snapshots()
        assert len(snapshots) == 1
