"""Force the test environment before app modules are imported."""

import os

os.environ["ENVIRONMENT"] = "test"
# Prefer an explicit test URL (CI); otherwise use the local test database.
# Always set DATABASE_URL so a development .env cannot point pytest at dish_list.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://localhost/dish_list_test",
)
