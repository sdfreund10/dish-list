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

Defaults assume Postgres.app’s local user with no password and a database named `dish_list`.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | API, Alembic | SQLAlchemy connection string |
| `CORS_ORIGINS` | API | Comma-separated allowed browser origins |
| `VITE_API_BASE_URL` | Frontend | Backend origin for API requests |

Secrets and local overrides stay in `.env`, which is gitignored.

## Database setup

1. Start Postgres.app.
2. Create the development database:

```bash
createdb dish_list
```

3. Apply migrations from the repository root:

```bash
uv sync
uv run alembic upgrade head
```

Reset the database:

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

Lint with Standard Style (`ts-standard`):

```bash
npm run lint
```

The Vite app listens on `http://localhost:5173` and uses `VITE_API_BASE_URL` (default `http://localhost:8000`) to reach the API.
