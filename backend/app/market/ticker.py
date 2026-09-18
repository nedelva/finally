"""Ticker string normalization and format validation.

The single normalization point shared by both `MarketDataSource`
implementations (`SimulatorDataSource`, `MassiveDataSource`) and the
watchlist API — replacing `MassiveDataSource`'s previous inline
`.upper().strip()` calls and adding equivalent handling to
`SimulatorDataSource`, which previously had none.
"""

from __future__ import annotations

import re

TICKER_FORMAT_RE = re.compile(r"[A-Z0-9]{1,5}")


def normalize_ticker(raw: str) -> str:
    """Uppercase + strip whitespace.

    The single normalization point shared by both MarketDataSource
    implementations and the watchlist API.
    """
    return raw.strip().upper()


def is_valid_ticker_format(normalized: str) -> bool:
    """1-5 alphanumeric characters. Expects already-normalized input."""
    return bool(TICKER_FORMAT_RE.fullmatch(normalized))
