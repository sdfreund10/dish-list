from collections.abc import Generator
from unittest.mock import MagicMock, patch

from app.db import get_db


def test_get_db_closes_session() -> None:
    session = MagicMock()

    with patch("app.db.SessionLocal", return_value=session):
        generator: Generator = get_db()
        yielded = next(generator)

        assert yielded is session

        generator.close()

    session.close.assert_called_once()
