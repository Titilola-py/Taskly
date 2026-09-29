# Daymark Todo — Project Guide

## Mission

Maintain Daymark as a polished, local-first task manager for one person. The application consists of a React and Vite client, a FastAPI JSON API, and a SQLite database stored on the user's machine.

## Product boundaries

- Users can create, edit, complete or reactivate, reorder, search, sort, filter, and delete tasks.
- A task has a required title of 1–240 characters. Titles are trimmed before storage.
- Tasks may have an optional due date, one category, and up to 10 tags.
- Task order and completion state persist in SQLite.
- The app has no accounts, cloud synchronization, multiple lists, or task descriptions in its current scope.
- Deletion is immediate. Completed tasks remain in the list until deleted.

## Architecture and ownership

- `backend/main.py` owns the API, validation, SQLite schema, task ordering, and database initialization.
- `backend/requirements.txt` lists Python dependencies.
- `frontend/src/` owns the React interface and styles.
- `frontend/vite.config.js` configures the development server and proxies `/api` to `http://127.0.0.1:8000`.
- `frontend/package.json` and `frontend/package-lock.json` define the JavaScript dependencies and scripts.
- `README.md` is the user-facing source for setup, operation, and API documentation.

## Engineering standards

### API and persistence

- Keep API payloads explicit, validated, and consistent with the frontend.
- Use parameterized SQL for values. Do not interpolate user-provided data into SQL.
- Persist every task-order change in SQLite; browser state is a view of the server state, not the source of truth.
- Keep schema initialization safe to run at every application startup.
- Add SQLite schema changes through startup migrations that preserve existing task data.
- Validate optional task metadata at the API boundary and return it consistently from create, list, and update routes.
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

## Local data

- The default database is `backend/todos.db`.
- FastAPI creates the database directory and `todos` table during application startup.
- The database is local application data; do not add it to source control or overwrite an existing user database as part of routine development.

## Change workflow

1. Read the relevant backend, frontend, and documentation code before changing behavior.
2. Preserve the existing product boundaries unless the requested change explicitly expands them.
3. Update affected API, UI, and documentation together.
4. Keep generated files and local data out of commits.
5. Run the documented checks when the user requests verification, or when verification is part of the requested deliverable. Report any checks that were not run.
