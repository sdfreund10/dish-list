# dish-list

Anonymous recipe-swiping experiment (MVP — Swipe Engagement).

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (Python 3.13 is installed automatically)
- Node.js and npm
- [Postgres.app](https://postgresapp.com/) with the CLI tools on your `PATH`

## Environment

```bash
cp .env.example .env
```

Defaults assume Postgres.app’s local user with no password. `ENVIRONMENT` selects the default database when `DATABASE_URL` is unset: `dish_list` for development, `dish_list_test` for test.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | API, Alembic, pytest | `development`, `test`, or `production` |
| `DATABASE_URL` | API, Alembic | Optional override of the environment default DB URL |
| `TEST_DATABASE_URL` | pytest | Optional override used only by tests |
| `CORS_ORIGINS` | API | Comma-separated allowed browser origins |
| `VITE_API_BASE_URL` | Frontend | Backend origin for API requests |

Secrets and local overrides stay in `.env`, which is gitignored.

## Database setup

1. Start Postgres.app.
2. Create the development and test databases:

```bash
createdb dish_list
createdb dish_list_test
```

3. Apply migrations from the repository root:

```bash
uv sync
uv run alembic upgrade head
ENVIRONMENT=test DATABASE_URL=postgresql+psycopg://localhost/dish_list_test uv run alembic upgrade head
```

Reset the development database:

```bash
dropdb dish_list && createdb dish_list
uv run alembic upgrade head
```

## Backend

From the repository root:

```bash
uv sync
uv run uvicorn app.main:app --reload
```

The API listens on `http://localhost:8000`. `GET /health` returns `{"status": "ok"}`.

Run tests and lint:

```bash
uv run pytest
uv run ruff check .
uv run ruff format --check .
```

### Recipe import

Place `recipes.json` at `data/recipes.json` locally (gitignored) or pass another path. Re-runs are idempotent by `source_id` and print inserted/updated/skipped/failed counts:

```bash
uv run import-recipes
uv run import-recipes path/to/recipes.json
```

### Migrations

Create a revision after changing models:

```bash
uv run alembic revision -m "describe the change"
```

Apply and roll back:

```bash
uv run alembic upgrade head
uv run alembic downgrade -1
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Lint, test, and production build (same checks as CI):

```bash
npm run lint
npm test
npm run build
```

The Vite app listens on `http://localhost:5173` and uses `VITE_API_BASE_URL` (default `http://localhost:8000`) to reach the API.

## Continuous integration

GitHub Actions runs on pushes to `main` and on pull requests:

- **Backend** (`.github/workflows/backend.yml`): `ruff check`, `ruff format --check`, migrate, and `pytest` against `dish_list_test`
- **Frontend** (`.github/workflows/frontend.yml`): `npm run lint`, `npm test`, and `npm run build`
