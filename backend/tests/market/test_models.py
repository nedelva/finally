"""Tests for PriceUpdate dataclass."""

import pytest

from app.market.models import PriceUpdate


class TestPriceUpdate:
    """Unit tests for the PriceUpdate model."""

    def test_price_update_creation(self):
        """Test basic PriceUpdate creation."""
        update = PriceUpdate(
            ticker="AAPL",
            price=190.50,
            previous_price=190.00,
            session_open_price=190.00,
            timestamp=1234567890.0,
        )
        assert update.ticker == "AAPL"
        assert update.price == 190.50
        assert update.previous_price == 190.00
        assert update.timestamp == 1234567890.0

    def test_change_calculation(self):
        """Test price change calculation is anchored to the session open."""
        update = PriceUpdate(
            ticker="AAPL",
            price=190.50,
            previous_price=190.00,
            session_open_price=190.00,
            timestamp=1234567890.0,
        )
        assert update.change == 0.50

    def test_change_negative(self):
        """Test negative price change against the session open."""
        update = PriceUpdate(
            ticker="AAPL",
            price=189.50,
            previous_price=190.00,
            session_open_price=190.00,
            timestamp=1234567890.0,
        )
        assert update.change == -0.50

    def test_change_percent_up(self):
        """Test percentage change calculation (up) against the session open."""
        update = PriceUpdate(
            ticker="AAPL",
            price=190.00,
            previous_price=100.00,
            session_open_price=100.00,
            timestamp=1234567890.0,
        )
        assert update.change_percent == 90.0

    def test_change_percent_down(self):
        """Test percentage change calculation (down) against the session open."""
        update = PriceUpdate(
            ticker="AAPL",
            price=100.00,
            previous_price=200.00,
            session_open_price=200.00,
            timestamp=1234567890.0,
        )
        assert update.change_percent == -50.0

    def test_change_percent_zero_session_open(self):
        """A session open of zero yields a change percent of 0.0, never raises."""
        update = PriceUpdate(
            ticker="AAPL",
            price=100.00,
            previous_price=100.00,
            session_open_price=0.00,
            timestamp=1234567890.0,
        )
        assert update.change_percent == 0.0

    def test_direction_up(self):
        """Test direction calculation (up); session open is irrelevant here."""
        update = PriceUpdate(
            ticker="AAPL",
            price=191.00,
            previous_price=190.00,
            session_open_price=190.00,
            timestamp=1234567890.0,
        )
        assert update.direction == "up"

    def test_direction_down(self):
        """Test direction calculation (down); session open is irrelevant here."""
        update = PriceUpdate(
            ticker="AAPL",
            price=189.00,
            previous_price=190.00,
            session_open_price=190.00,
            timestamp=1234567890.0,
        )
        assert update.direction == "down"

    def test_direction_flat(self):
        """Test direction calculation (flat); session open is irrelevant here."""
        update = PriceUpdate(
            ticker="AAPL",
            price=190.00,
            previous_price=190.00,
            session_open_price=190.00,
            timestamp=1234567890.0,
        )
        assert update.direction == "flat"

    def test_direction_and_change_percent_can_disagree(self):
        """Direction (tick-to-tick) and change_percent (session) are independent
        anchors and can legitimately disagree: a price below the previous tick
        but above the session open is a downtick that is still up on the day.
        """
        update = PriceUpdate(
            ticker="AAPL",
            price=150.00,
            previous_price=160.00,
            session_open_price=100.00,
            timestamp=1234567890.0,
        )
        assert update.direction == "down"
        assert update.change_percent == 50.0

    def test_to_dict(self):
        """Test serialization to dictionary; change/change_percent are
        session-anchored, direction stays tick-anchored."""
        update = PriceUpdate(
            ticker="AAPL",
            price=190.50,
            previous_price=190.00,
            session_open_price=100.00,
            timestamp=1234567890.0,
        )
        result = update.to_dict()

        assert result["ticker"] == "AAPL"
        assert result["price"] == 190.50
        assert result["previous_price"] == 190.00
        assert result["timestamp"] == 1234567890.0
        assert result["change"] == 90.50
        assert result["change_percent"] == 90.5
        assert result["direction"] == "up"

    def test_to_dict_key_set_is_exactly_seven_names(self):
        """to_dict() is a frozen contract: exactly these seven keys, no more,
        no fewer — matches PriceTick in frontend/lib/types.ts verbatim."""
        update = PriceUpdate(
            ticker="AAPL",
            price=190.50,
            previous_price=190.00,
            session_open_price=100.00,
            timestamp=1234567890.0,
        )
        assert set(update.to_dict().keys()) == {
            "ticker",
            "price",
            "previous_price",
            "timestamp",
            "change",
            "change_percent",
            "direction",
        }

    def test_immutability(self):
        """Test that PriceUpdate is immutable."""
        update = PriceUpdate(
            ticker="AAPL",
            price=190.50,
            previous_price=190.00,
            session_open_price=190.00,
            timestamp=1234567890.0,
        )

        with pytest.raises(AttributeError):
            update.price = 200.00  # Should raise error
