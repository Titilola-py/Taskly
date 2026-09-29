# Taskly Todo — Project Guide

## Mission

Maintain Taskly as a polished, local-first task manager for one person. The application consists of a React and Vite client, a FastAPI JSON API, and a SQLite database stored on the user's machine.

## Product boundaries

- Users can create, edit, complete or reactivate, reorder, search, sort, filter, and delete tasks, with optional notes on each task.
- A task has a required title of 1–240 characters. Titles are trimmed before storage.
- A task may have up to 5,000 characters of notes. Notes are trimmed at the beginning and end while internal line breaks are preserved.
- Tasks may have an optional due date, one category, and up to 10 tags.
- Task order and completion state persist in SQLite.
- The app has no individual user accounts, cloud synchronization, multiple lists, or rich task documents. A task may have optional plain-text notes.
- Deletion is immediate. Completed tasks remain in the list until deleted.

## Architecture and ownership

- `backend/main.py` owns the API, validation, SQLite schema, task ordering, and database initialization.
- `backend/test_main.py` contains standard-library backend API and SQLite migration tests; `backend/requirements-dev.txt` lists the HTTP test client dependency.
- `backend/requirements.txt` lists Python dependencies.
- `frontend/src/` owns the React interface and styles.
- `frontend/vite.config.js` configures the development server and proxies `/api` to `http://127.0.0.1:8000`.
- `frontend/package.json` and `frontend/package-lock.json` define the JavaScript dependencies and scripts.
- `Dockerfile`, `.dockerignore`, and `render.yaml` define the single-service Render deployment; it serves the built React client from FastAPI and stores demo SQLite data at `/tmp/todos.db` on Render's ephemeral filesystem.
- `README.md` is the user-facing source for setup, operation, and API documentation.

## Engineering standards

### API and persistence

- Keep API payloads explicit, validated, and consistent with the frontend.
- Use parameterized SQL for values. Do not interpolate user-provided data into SQL.
- Persist every task-order change in SQLite; browser state is a view of the server state, not the source of truth.
- Keep schema initialization safe to run at every application startup.
- Add SQLite schema changes through startup migrations that preserve existing task data.
- Validate optional task metadata at the API boundary and return it consistently from create, list, and update routes.
- Return notes consistently from create, list, and update routes. Add new SQLite columns through migrations that preserve existing tasks.
- Return appropriate HTTP errors for invalid input and missing tasks.
- If an API route, payload, or response changes, update the frontend and README in the same change.

### Interface and accessibility

- Keep the interface responsive on narrow screens and usable with keyboard and assistive technology.
- Give controls accessible names, communicate loading and error states, and preserve clear focus indicators.
- Keep task actions understandable and prevent duplicate submissions while a request is in progress.
- Avoid adding external services or dependencies unless the product needs them. System font fallbacks should remain available if Google Fonts cannot load.

### Dependencies and configuration

- Keep dependencies focused and use the lockfile when installing frontend packages.
- Keep local configuration in environment variables where appropriate. `TODO_DATABASE_PATH` overrides the default SQLite file path.
- Do not commit virtual environments, `node_modules`, build output, local databases, secrets, or runtime logs.
- Keep development CORS settings limited to the local frontend origins unless a deliberate deployment change requires otherwise.
- The Render Blueprint uses the free web service without authentication so tutors can access it. Anyone with the URL can view and modify the shared tasks; clearly state this and never include sensitive data. SQLite tasks may disappear on free-tier spin-down, restart, or redeploy; use persistent storage for data that must be retained.

## Local data

- The default database is `backend/todos.db`.
- FastAPI creates the database directory and `todos` table during application startup.
- The database is local application data; do not add it to source control or overwrite an existing user database as part of routine development.

## Testing and validation rules

### Before changing behavior

- Identify the affected API routes, database behavior, UI states, and documented setup steps before editing.
- Preserve the existing local database during development and verification. Use a temporary database path for checks that create or modify data.
- Do not claim a check passed unless you ran it and observed a successful result. Report skipped checks and environment blockers.

### Required checks

- For backend changes, run the backend test suite when tests are present: `python -m unittest discover -s backend -p "test_*.py"` from the repository root. If no backend tests cover the changed behavior, add focused tests using a temporary SQLite database before considering the change verified.
- For frontend changes, run `npm run build` from `frontend/` and address build errors caused by the change.
- For a change that affects both API and UI, run both the backend tests and frontend build.
- For database/schema changes, verify startup against a temporary database and confirm existing rows survive any migration.
- If a required check cannot run (for example, dependencies are not installed), state that clearly instead of treating it as a pass.

### API validation coverage

- Check that task titles are trimmed and that blank, too-short, or over-240-character titles are rejected with a client error.
- Check that optional due date, category, and tag inputs accept valid values and reject invalid formats or more than 10 tags.
- Check that notes are trimmed, can contain line breaks, allow up to 5,000 characters, reject longer values, and persist through create, edit, list, and reload.
- Check that updating or deleting a missing task returns 404, and malformed or invalid payloads return an appropriate 4xx response.
- Check that reorder requests include every existing task exactly once; invalid or duplicate IDs must not change the saved order.
- Check that create, update, list, and reorder responses agree with the values persisted in SQLite after reopening the database session.

### Browser smoke check

- Start FastAPI and Vite using the commands in `README.md`, then verify the page loads without console errors.
- Add a task, reload the page, mark it complete and active again, reorder it, and delete it; confirm each change persists after reload.
- Add notes to a task, reload, edit the notes, search for text in the notes, and confirm the changes persist.
- Verify search, sort, and filters against a small set of tasks, including completed tasks.
- Verify empty, loading, and error states, keyboard operation, visible focus, and a narrow mobile viewport when the changed UI touches those areas.

## Change workflow

1. Read the relevant backend, frontend, and documentation code before changing behavior.
2. Preserve the existing product boundaries unless the requested change explicitly expands them.
3. Update affected API, UI, and documentation together.
4. Keep generated files and local data out of commits.
5. Run the checks required by the testing and validation rules for the affected areas. Report the commands run and any checks not run.
