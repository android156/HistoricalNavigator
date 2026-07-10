# AGENTS.md

## Project

Historical Navigator is a Flask web application that combines Yandex Maps with OpenAI-generated historical descriptions and images. The current codebase was migrated from Replit and is being stabilized for local development.

## Stack

- Python 3.11+
- Flask and Flask-SQLAlchemy
- SQLite by default; `DATABASE_URL` can override it
- OpenAI API (`gpt-4o`, `gpt-image-2` by default)
- Vanilla JavaScript, Bootstrap, Yandex Maps API
- `uv` for dependency and environment management
- `pytest` for tests

## Local setup

Run commands from the repository root:

```bash
uv sync
cp .env.example .env
set -a; source .env; set +a
uv run python main.py
```

The app listens on `http://127.0.0.1:5000` by default.

Required for full functionality:

- `YANDEX_MAPS_API_KEY`: map and geocoding
- `OPENAI_API_KEY`: historical data and image generation
- `FLASK_SECRET_KEY`: Flask secret

Optional:

- `DATABASE_URL` (default: `sqlite:///history.db`)
- `PORT` (default: `5000`)
- `PROXY_URL` (optional HTTP/HTTPS proxy for OpenAI requests only)
- `OPENAI_IMAGE_MODEL` (default: `gpt-image-2`)
- `OPENAI_IMAGE_QUALITY` (default: `medium`)

The app must remain startable without external API keys. Missing OpenAI configuration should produce a controlled `503`, not an import-time crash.

## Verification

Run after every code change:

```bash
uv run pytest -q
python -m py_compile app.py main.py models.py utils.py museum_api.py migrate_images.py clean_points.py check_points.py
```

For HTTP changes, also run the app with a disposable database and smoke-test the affected endpoints:

```bash
DATABASE_URL='sqlite:///:memory:' PORT=5000 uv run python main.py
```

## Repository map

- `app.py`: Flask app, database, environment configuration
- `main.py`: routes and local server entry point
- `models.py`: SQLAlchemy models
- `utils.py`: OpenAI calls, persistence, image downloading
- `museum_api.py`: museum artifact integration; currently contains placeholder data
- `templates/`: Jinja templates
- `static/js/`: map and UI behavior
- `static/images/historical/`: persisted generated images
- `instance/history.db`: existing application data
- `tests/`: regression tests

## Change discipline

- Prefer small, focused changes over broad refactors.
- Add a failing regression test before fixing behavior.
- Do not expose API keys in source, logs, tests, screenshots, or commits.
- Do not overwrite or delete `instance/history.db` unless the task explicitly requires database reset/migration.
- Use an in-memory or temporary database for automated tests and smoke checks.
- Do not call paid OpenAI endpoints during tests; isolate or mock external API boundaries.
- Preserve the current API response contract unless a deliberate migration is documented.
- Validate coordinates, time periods, external responses, and downloaded image content.
- Never report a successful run without executing the relevant tests or smoke checks.

## Known technical debt

- Flask app creation and route registration still rely on module-level globals.
- Museum API responses are placeholders, not real integrations.
- Historical points endpoint is unpaginated and can return a large payload.
- Some stored OpenAI image URLs are expired temporary links.
- Frontend rendering uses large HTML template strings and needs explicit output escaping.
