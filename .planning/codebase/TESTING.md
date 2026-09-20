---
last_mapped_commit: 2f4b34d05aaac05ac02511c79caddbd183641373
last_mapped_at: 2026-09-17
---
# Testing Patterns

**Analysis Date:** 2026-09-17

## Test Framework

**Runner:**

- pytest 8.3+ (configured in `backend/pyproject.toml`)
- Config file: `backend/pyproject.toml` under `[tool.pytest.ini_options]`

**Test discovery:**

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
asyncio_mode = "auto"
```

**Async support:**

- `pytest-asyncio` 0.24+
- `asyncio_mode = "auto"` — allows `async def test_*()` without decorators in some cases, but explicit `@pytest.mark.asyncio` is still used

**Assertion Library:**

- pytest built-in assertions
- No special assertion library; uses plain `assert` statements

**Run Commands:**

```bash
cd backend

# All tests

uv run --extra dev pytest -v

# With coverage

uv run --extra dev pytest --cov=app -v

# Specific test file

uv run --extra dev pytest tests/market/test_cache.py -v

# Specific test class

uv run --extra dev pytest tests/market/test_cache.py::TestPriceCache -v

# Watch mode (requires pytest-watch, not in dependencies yet)

# uv run --extra dev ptw

# Lint

uv run --extra dev ruff check app/ tests/
```

## Test File Organization

**Location:**

- Tests live in `backend/tests/` mirroring `backend/app/` structure
- Example: `app/market/cache.py` → `tests/market/test_cache.py`

**Naming:**

- Test modules: `test_*.py`
- Test classes: `Test*` (e.g., `TestPriceCache`, `TestGBMSimulator`)
- Test methods: `test_*` (e.g., `test_update_and_get`, `test_direction_up`)

**Directory structure:**

```
backend/
├── app/
│   └── market/
│       ├── __init__.py
│       ├── models.py
│       ├── cache.py
│       ├── interface.py
│       └── ...
└── tests/
    ├── conftest.py              # Shared fixtures
    └── market/
        ├── test_models.py       # Tests for models.py
        ├── test_cache.py        # Tests for cache.py
        ├── test_simulator.py    # Tests for simulator.py
        ├── test_massive.py      # Tests for massive_client.py
        ├── test_factory.py      # Tests for factory.py
        └── ...
```

## Test Structure

**Suite Organization:**

```python
"""Tests for PriceCache."""

from app.market.cache import PriceCache

class TestPriceCache:
    """Unit tests for the PriceCache."""

    def test_update_and_get(self):
        """Test updating and getting a price."""
        # Arrange
        cache = PriceCache()
        
        # Act
        update = cache.update("AAPL", 190.50)
        
        # Assert
        assert update.ticker == "AAPL"
        assert update.price == 190.50
        assert cache.get("AAPL") == update
```

**Patterns:**

1. **Arrange-Act-Assert (AAA):**
   - Setup/arrange: create fixtures and test data
   - Act: call the function/method being tested
   - Assert: verify the results

2. **Docstrings on Every Test:**
   - One-line description of what's being tested
   - Appears in pytest verbose output
   - Example: `"""Test that the first update has flat direction."""`

3. **Class-based organization:**
   - Group related tests in a `Test*` class
   - All tests in the class are independent (no shared state)
   - Each test sets up its own fixtures (no class-level setup)

## Test Structure (Async)

**Async test class:**

```python
@pytest.mark.asyncio
class TestSimulatorDataSource:
    """Integration tests for the SimulatorDataSource."""

    async def test_start_populates_cache(self):
        """Test that start() immediately populates the cache."""
        cache = PriceCache()
        source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
        await source.start(["AAPL", "GOOGL"])
        
        assert cache.get("AAPL") is not None
        assert cache.get("GOOGL") is not None
        
        await source.stop()
```

**Requirements:**

- Place `@pytest.mark.asyncio` on the test class
- Use `async def` for test methods
- Use `await` for async calls
- Use `await asyncio.sleep()` for timing tests
- Always call cleanup (e.g., `await source.stop()`) at the end

## Mocking

**Framework:** `unittest.mock` (standard library)

**Common patterns:**

1. **MagicMock for fake objects:**
   ```python
   snap = MagicMock()
   snap.ticker = "AAPL"
   snap.last_trade = MagicMock()
   snap.last_trade.price = 190.50
   ```

2. **patch() for replacing functions/classes:**
   ```python
   with patch("app.market.massive_client.RESTClient") as mock_client:
       # RESTClient is mocked here
       pass
   ```

3. **patch.object() for replacing methods:**
   ```python
   with patch.object(source, "_fetch_snapshots", return_value=[]):
       await source._poll_once()
   ```

4. **return_value for fixed return:**
   ```python
   with patch.object(source, "_fetch_snapshots", return_value=[snap1, snap2]):
       await source._poll_once()
   ```

5. **side_effect for exceptions:**
   ```python
   with patch.object(source, "_fetch_snapshots", side_effect=Exception("network error")):
       await source._poll_once()  # Should not raise
   ```

6. **patch.dict() for environment variables:**
   ```python
   with patch.dict(os.environ, {"MASSIVE_API_KEY": "test-key"}, clear=True):
       source = create_market_data_source(cache)
   ```
   - `clear=True`: remove all other env vars (ensures isolation)
   - Useful for factory tests that check environment-based branching

**Real example from `tests/market/test_massive.py`:**

```python
def _make_snapshot(ticker: str, price: float, timestamp_ms: int) -> MagicMock:
    """Create a mock Massive snapshot object."""
    snap = MagicMock()
    snap.ticker = ticker
    snap.last_trade = MagicMock()
    snap.last_trade.price = price
    snap.last_trade.timestamp = timestamp_ms
    return snap

async def test_poll_updates_cache(self):
    """Test that polling updates the cache."""
    cache = PriceCache()
    source = MassiveDataSource(api_key="test-key", price_cache=cache, poll_interval=60.0)
    source._tickers = ["AAPL", "GOOGL"]
    source._client = MagicMock()
    
    mock_snapshots = [
        _make_snapshot("AAPL", 190.50, 1707580800000),
        _make_snapshot("GOOGL", 175.25, 1707580800000),
    ]
    
    with patch.object(source, "_fetch_snapshots", return_value=mock_snapshots):
        await source._poll_once()
    
    assert cache.get_price("AAPL") == 190.50
    assert cache.get_price("GOOGL") == 175.25
```

## Fixtures and Factories

**Test Data:**

- Most tests create lightweight fixtures inline (e.g., `cache = PriceCache()`)
- Use helper functions for complex objects

**Helper function pattern (from `tests/market/test_massive.py`):**

```python
def _make_snapshot(ticker: str, price: float, timestamp_ms: int) -> MagicMock:
    """Create a mock Massive snapshot object."""
    snap = MagicMock()
    snap.ticker = ticker
    snap.last_trade = MagicMock()
    snap.last_trade.price = price
    snap.last_trade.timestamp = timestamp_ms
    return snap

# Usage in multiple tests

mock_snapshots = [
    _make_snapshot("AAPL", 190.50, 1707580800000),
    _make_snapshot("GOOGL", 175.25, 1707580800000),
]
```

**Shared fixtures (in `backend/tests/conftest.py`):**

```python
@pytest.fixture
def event_loop_policy():
    """Use the default event loop policy for all async tests."""
    import asyncio
    return asyncio.DefaultEventLoopPolicy()
```

## Coverage

**Requirements:** No hard target enforced; coverage is measured but optional

**View Coverage:**

```bash
cd backend
uv run --extra dev pytest --cov=app --cov-report=html

# Opens coverage report in htmlcov/index.html

```

**Configuration (in `pyproject.toml`):**

```toml
[tool.coverage.run]
source = ["app"]
omit = ["tests/*"]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
    "if __name__ == .__main__.:",
    "if TYPE_CHECKING:",
]
```

## Test Types

**Unit Tests:**

- Scope: single class or function
- Example: `TestPriceCache`, `TestPriceUpdate`, `TestGBMSimulator`
- Isolation: create fresh instances for each test
- No I/O, no async operations (usually)
- Run in < 100ms per test

**Integration Tests:**

- Scope: multiple components working together
- Example: `TestSimulatorDataSource` (simulator + cache), `TestMassiveDataSource` (client + cache)
- May use mocking for external dependencies
- Use async tests for lifecycle (start/stop)
- Verify component interactions

**E2E Tests:**

- Not yet implemented (will be in `test/` directory with Playwright)
- Will test full user flows through the app

## Common Patterns

**Testing state changes:**

```python
def test_update_and_get(self):
    """Test updating and getting a price."""
    cache = PriceCache()
    update = cache.update("AAPL", 190.50)
    assert cache.get("AAPL") == update
```

**Testing computed properties:**

```python
def test_direction_up(self):
    """Test direction calculation (up)."""
    update = PriceUpdate(
        ticker="AAPL",
        price=191.00,
        previous_price=190.00,
        timestamp=1234567890.0
    )
    assert update.direction == "up"
```

**Testing edge cases:**

```python
def test_change_percent_zero_previous(self):
    """Test percentage change with zero previous price."""
    update = PriceUpdate(
        ticker="AAPL",
        price=100.00,
        previous_price=0.00,
        timestamp=1234567890.0
    )
    assert update.change_percent == 0.0  # Avoid division by zero
```

**Testing idempotency:**

```python
async def test_remove_nonexistent(self):
    """Test removing a ticker that doesn't exist."""
    cache = PriceCache()
    cache.remove("AAPL")  # Should not raise
```

**Testing immutability:**

```python
def test_immutability(self):
    """Test that PriceUpdate is immutable."""
    update = PriceUpdate(
        ticker="AAPL",
        price=190.50,
        previous_price=190.00,
        timestamp=1234567890.0
    )
    
    with pytest.raises(AttributeError):
        update.price = 200.00  # Should raise error
```

**Testing async workflow (lifecycle):**

```python
async def test_start_populates_cache(self):
    """Test that start() immediately populates the cache."""
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.1)
    
    await source.start(["AAPL", "GOOGL"])
    # Verify cache is populated immediately
    assert cache.get("AAPL") is not None
    assert cache.get("GOOGL") is not None
    
    await source.stop()
```

**Testing with timing (slow but important):**

```python
async def test_prices_update_over_time(self):
    """Test that prices are updated periodically."""
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.05)
    await source.start(["AAPL"])
    
    initial_version = cache.version
    await asyncio.sleep(0.3)  # Several update cycles
    
    # Version should have incremented (prices updated)
    assert cache.version > initial_version
    
    await source.stop()
```

**Testing error recovery:**

```python
async def test_api_error_does_not_crash(self):
    """Test that API errors don't crash the poller."""
    cache = PriceCache()
    source = MassiveDataSource(
        api_key="test-key",
        price_cache=cache,
        poll_interval=60.0,
    )
    source._tickers = ["AAPL"]
    source._client = MagicMock()
    
    with patch.object(source, "_fetch_snapshots", side_effect=Exception("network error")):
        await source._poll_once()  # Should not raise
    
    assert cache.get_price("AAPL") is None  # No update happened
```

**Testing with parametrization (if needed in future):**

```python
import pytest

@pytest.mark.parametrize("ticker,expected_price", [
    ("AAPL", SEED_PRICES["AAPL"]),
    ("GOOGL", SEED_PRICES["GOOGL"]),
])
def test_seed_prices(ticker, expected_price):
    """Test that initial prices match seed prices."""
    sim = GBMSimulator(tickers=[ticker])
    assert sim.get_price(ticker) == expected_price
```

## Test Coverage Gaps

**Currently Tested:**

- All market data models (PriceUpdate, calculations, properties)
- PriceCache (thread-safety, mutations, version tracking)
- Simulator (step logic, ticker management, correlation)
- SimulatorDataSource (lifecycle, streaming, resilience)
- MassiveDataSource (polling, error handling, API parsing)
- Factory selection logic (environment variables)

**Not yet tested (scaffold only):**

- Frontend components and interactions
- FastAPI endpoints (API routes, SSE handler will be tested when E2E tests are added)
- Portfolio logic (not yet implemented)
- Trade execution (not yet implemented)
- Chat integration (not yet implemented)
- Database layer (not yet implemented)

## Best Practices

**Do:**

- Write one assertion per concept (may have multiple `assert` statements per test)
- Use descriptive test names that explain what's being tested
- Test the happy path and edge cases
- Test error conditions (exceptions, timeouts, API errors)
- Use `pytest.raises()` to verify exceptions are raised
- Test idempotency (calling a function twice has the same effect)
- Keep tests fast (< 1 second per test, < 5 seconds total suite)
- Use mocking to isolate units and avoid external dependencies

**Don't:**

- Share state between tests (each test should be independent)
- Use `time.sleep()` for testing (use `await asyncio.sleep()` for async, or mock time)
- Mock internals unless testing specifically how they're used
- Test implementation details unless verifying a contract
- Write tests for obvious getters/setters
- Import entire modules; import specific names

---

*Testing analysis: 2026-09-17*
