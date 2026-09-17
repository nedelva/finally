---
last_mapped_commit: 2f4b34d05aaac05ac02511c79caddbd183641373
last_mapped_at: 2026-09-17
---
# Coding Conventions

**Analysis Date:** 2026-09-17

## Overview

The FinAlly backend follows strict Python conventions emphasizing type safety, clarity, and maintainability. All code uses Python 3.12+ features. The frontend is currently scaffolding only; these conventions focus on the implemented backend (`backend/app/`).

## Naming Patterns

**Files:**

- Lowercase with underscores: `price_cache.py`, `market_data_source.py`
- Test files: `test_cache.py`, `test_simulator.py`
- Module docstrings describe public API and exports

**Functions:**

- Lowercase with underscores: `create_market_data_source()`, `get_price()`, `_rebuild_cholesky()`
- Public functions: no leading underscore
- Private/internal functions: leading `_` to indicate internal use
- Async functions: no special naming, use `async def`

**Variables:**

- Lowercase with underscores: `ticker`, `price`, `update_interval`, `api_key`
- Private attributes: leading underscore: `self._cache`, `self._tickers`, `self._lock`
- Constants: `UPPERCASE_WITH_UNDERSCORES`: `DEFAULT_DT`, `TRADING_SECONDS_PER_YEAR`, `SPARK_CHARS`
- Computed properties: no prefix: `@property def direction(self):`

**Types:**

- PascalCase: `PriceUpdate`, `PriceCache`, `GBMSimulator`, `SimulatorDataSource`, `MassiveDataSource`
- Abstract base: `MarketDataSource` (inherits from `ABC`)

## Code Style

**Formatting:**

- Line length: 100 characters (enforced by ruff)
- Indentation: 4 spaces
- Imports: organized with `from __future__ import annotations` at the top
- Type hints: always used, using Python 3.10+ union syntax (`float | None` not `Optional[float]`)

**Linting:**

- Tool: ruff
- Rules enabled: E (errors), F (pyflakes), I (isort), N (naming), W (warnings)
- Config: `backend/pyproject.toml` under `[tool.ruff]`
- Line length error (E501) is ignored — handled by formatter

**Import Organization:**

```python
from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from dataclasses import dataclass, field
from threading import Lock
from unittest.mock import MagicMock, patch

import numpy as np
from fastapi import APIRouter, Request

from .cache import PriceCache
from .interface import MarketDataSource
```

Order:

1. `from __future__` imports
2. Standard library (alphabetical)
3. Third-party packages (alphabetical)
4. Local imports (relative with dot notation)

**Path Aliases:**

- None defined. Use relative imports (`from .cache import`) or absolute from `app` root.

## Error Handling

**Patterns:**

- Specific exception catching: catch only expected exceptions
  ```python
  try:
      price = snap.last_trade.price
  except (AttributeError, TypeError) as e:
      logger.warning("Skipping snapshot: %s", e)
  ```

- Background tasks (async loops): catch `Exception` broadly but log and do not re-raise
  ```python
  try:
      if self._sim:
          prices = self._sim.step()
          for ticker, price in prices.items():
              self._cache.update(ticker=ticker, price=price)
  except Exception:
      logger.exception("Simulator step failed")
  await asyncio.sleep(self._interval)
  ```

- Async task cancellation: catch `asyncio.CancelledError` when cleaning up
  ```python
  if self._task and not self._task.done():
      self._task.cancel()
      try:
          await self._task
      except asyncio.CancelledError:
          pass
  ```

- Return `None` for "not found" cases (not exceptions)
  ```python
  def get_price(self, ticker: str) -> float | None:
      update = self.get(ticker)
      return update.price if update else None
  ```

- Always use `logger.exception()` in except blocks to capture full traceback

## Logging

**Framework:** Python's `logging` module

**Pattern:**

```python
import logging

logger = logging.getLogger(__name__)
```

Each module creates a module-level logger using `__name__`. All logging uses this logger.

**When to log:**

- **INFO** (`logger.info()`): important lifecycle events (start/stop, resource creation)
  ```python
  logger.info("Simulator started with %d tickers", len(tickers))
  ```
- **DEBUG** (`logger.debug()`): per-iteration detail (every step, every poll)
  ```python
  logger.debug("Simulator step: updated %d/%d tickers", processed, len(tickers))
  ```
- **WARNING** (`logger.warning()`): recoverable issues (malformed data, skipped items)
  ```python
  logger.warning("Skipping snapshot for %s: %s", ticker, e)
  ```
- **ERROR** (`logger.error()`): failures but continuing (API error in background loop)
  ```python
  logger.error("Massive poll failed: %s", e)
  ```
- **EXCEPTION** (`logger.exception()`): in except blocks to capture full traceback
  ```python
  except Exception:
      logger.exception("Simulator step failed")  # Includes traceback
  ```

**Patterns:**

- Use `%` formatting for all log messages (not f-strings)
- Include context where helpful (ticker name, count of items, etc.)
- Avoid logging PII or secrets

## Comments

**When to Comment:**

- Complex algorithms (e.g., GBM math, Cholesky decomposition, correlation logic)
- Non-obvious design decisions
- Workarounds and hacks (though these should be rare)
- Assumptions about behavior (e.g., "PriceUpdate is immutable and hashable")

**Not usually needed:**

- Code that reads clearly on its own
- Obvious loops and conditionals
- "This gets the price" comments when `get_price()` is self-documenting

**Format:**

```python

# This is a single-line comment

# spanning multiple lines if needed

"""This is a docstring."""
```

**Docstrings (JSDoc/TSDoc):**

- All public classes: full docstring with purpose and lifecycle
- All public functions: docstring with purpose, args (if needed), return type (if not obvious)
- Private methods: short docstring (one sentence) if non-obvious
- Example (from `cache.py`):
  ```python
  def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
      """Record a new price for a ticker. Returns the created PriceUpdate.

      Automatically computes direction and change from the previous price.
      If this is the first update for the ticker, previous_price == price (direction='flat').
      """
  ```

## Function Design

**Size:**

- Keep functions focused: one responsibility per function
- If a function exceeds ~50 lines, consider splitting it
- Example: `GBMSimulator.step()` is the hot path and ~40 lines; `_rebuild_cholesky()` is separate

**Parameters:**

- Use positional for required args: `update(ticker, price)`
- Use keyword-only for optional/config: `__init__(..., update_interval: float = 0.5)`
- Type hints on all parameters

**Return Values:**

- Type hints on all return types (include `| None` if applicable)
- Prefer returning values over raising exceptions for non-error conditions
- Return `None` for "not found" cases; raise exceptions for bugs

**Async:**

- Use `async def` for functions that call `await` or are entry points to async tasks
- Use `await asyncio.sleep()` for delays, never `time.sleep()`
- Use `await asyncio.to_thread()` to run sync code without blocking the event loop

## Module Design

**Exports:**

- Define `__all__` in every module's `__init__.py`
- Example (`app/market/__init__.py`):
  ```python
  __all__ = [
      "PriceUpdate",
      "PriceCache",
      "MarketDataSource",
      "create_market_data_source",
      "create_stream_router",
  ]
  ```

**Barrel Files:**

- Use `__init__.py` to re-export public types and factories
- Include a module docstring listing the public API
- Clients import from `app.market`, not `app.market.cache`, etc.

**Example structure:**

```
app/market/
├── __init__.py          # Public API exports, docstring
├── models.py            # PriceUpdate dataclass
├── cache.py             # PriceCache class
├── interface.py         # MarketDataSource abstract class
├── simulator.py         # GBMSimulator, SimulatorDataSource
├── massive_client.py    # MassiveDataSource
├── factory.py           # create_market_data_source()
└── stream.py            # create_stream_router()
```

## Special Patterns

**Dataclasses:**

- Use `@dataclass(frozen=True, slots=True)` for immutable value objects
  ```python
  @dataclass(frozen=True, slots=True)
  class PriceUpdate:
      ticker: str
      price: float
      previous_price: float
      timestamp: float = field(default_factory=time.time)
  ```

**Abstract Base Classes:**

- Define interface in a separate `interface.py` file
- Inherit from `ABC` and use `@abstractmethod` decorators
- Docstring describes the contract and lifecycle
  ```python
  class MarketDataSource(ABC):
      @abstractmethod
      async def start(self, tickers: list[str]) -> None:
          """Begin producing price updates for the given tickers."""
  ```

**Thread Safety:**

- Use `threading.Lock` for shared mutable state
- Always acquire the lock around read-modify-write operations
  ```python
  def update(self, ticker: str, price: float) -> PriceUpdate:
      with self._lock:
          prev = self._prices.get(ticker)
          # ... update logic ...
          self._prices[ticker] = update
          return update
  ```

**Factory Pattern:**

- Create sources via factory functions, not direct constructors
- Example (`factory.py`):
  ```python
  def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
      api_key = os.environ.get("MASSIVE_API_KEY", "").strip()
      if api_key:
          return MassiveDataSource(api_key=api_key, price_cache=price_cache)
      else:
          return SimulatorDataSource(price_cache=price_cache)
  ```

## Type Hints

**Rules:**

- Every function has a return type hint
- Every parameter has a type hint
- Use `from __future__ import annotations` for forward references
- Use `| None` instead of `Optional[...]`
- Use `type[X]` for type parameters, not `Type[X]`
- Use collection types: `list[str]`, `dict[str, float]`, `AsyncGenerator[str, None]`

**Examples:**

```python
def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
    """Record a new price."""

async def _generate_events(
    price_cache: PriceCache,
    request: Request,
    interval: float = 0.5,
) -> AsyncGenerator[str, None]:
    """Async generator that yields SSE events."""

def get_tickers(self) -> list[str]:
    """Return the current list of tickers."""
    return list(self._tickers)
```

## Magic Methods

**When to override:**

- `__len__`: implement for container-like classes
  ```python
  def __len__(self) -> int:
      with self._lock:
          return len(self._prices)
  ```

- `__contains__`: implement for membership testing
  ```python
  def __contains__(self, ticker: str) -> bool:
      with self._lock:
          return ticker in self._prices
  ```

- `__repr__`: implement for debugging if needed (commented out for now)
  - Dataclasses with `@dataclass` auto-generate this

**Not needed:**

- `__str__`: unless you need a user-facing string representation
- `__eq__`, `__hash__`: auto-generated by frozen dataclasses

---

*Convention analysis: 2026-09-17*
