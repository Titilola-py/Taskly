# Taskly Todo

Taskly is a local-first task manager for keeping a focused list of things to do. Create tasks, mark them complete, reorder them, and remove them. The app uses a React interface, a FastAPI JSON API, and SQLite for persistent local storage.

## Features

- Create tasks with a required title of up to 240 characters.
- Mark tasks complete or active.
- Move tasks up or down; ordering is saved in SQLite.
- Filter the list by all, active, or completed tasks.
- Add optional due dates, categories, and tags to tasks; edit these details later.
- Add up to 5,000 characters of notes to a task; search also matches task notes.
- Search task titles, categories, and tags, and filter the list by category.
- Sort by saved order, due date, title, category, or date added.
- Use the responsive interface with keyboard-accessible controls.
- Run locally without accounts or cloud synchronization.

## Requirements

- Python 3.10 or newer
- Node.js 18 or newer and npm

## Quick start

Run the backend and frontend in separate terminals from the project directory.

### 1. Start the backend

#### Windows PowerShell

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

If the Python launcher `py` is unavailable, replace `py` with `python` when creating the virtual environment.

#### macOS or Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

The API is available at `http://127.0.0.1:8000`. Interactive API documentation is at `http://127.0.0.1:8000/docs`.

### 2. Start the frontend

In a second terminal, from the project directory:

```bash
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. The Vite development server forwards `/api` requests to the backend on port 8000.

## Data and configuration

On startup, the backend creates the SQLite database and `todos` table if they do not already exist. By default, the database file is `backend/todos.db`. The file is local and is excluded from source control.

To choose a different database file, set `TODO_DATABASE_PATH` before starting the backend.

PowerShell:

```powershell
$env:TODO_DATABASE_PATH = "C:\data\taskly.db"
uvicorn main:app --reload
```

macOS or Linux:

```bash
export TODO_DATABASE_PATH="$HOME/.local/share/taskly/todos.db"
uvicorn main:app --reload
```

## API reference

All routes use the `/api` prefix and exchange JSON unless otherwise stated.

| Method | Path | Purpose | Success response |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Check that the API is available | `200` with `{ "status": "ok" }` |
| `GET` | `/api/todos` | List tasks in saved order | `200` with an array of tasks |
| `POST` | `/api/todos` | Create a task | `201` with the created task |
| `PATCH` | `/api/todos/{id}` | Change the title, completion state, due date, category, tags, and/or notes | `200` with the updated task |
| `POST` | `/api/todos/{id}/move?direction=up or down` | Move a task one position | `200` with the ordered task array |
| `DELETE` | `/api/todos/{id}` | Delete a task | `204` with no response body |

Task titles must contain 1–240 characters. The frontend trims surrounding whitespace before submitting a title. A task returned by the API has this shape:

```json
{
  "id": 1,
  "title": "Review project notes",
  "completed": false,
  "position": 0,
  "created_at": "2026-09-29T09:00:00.000Z",
  "due_date": "2026-10-02",
  "category": "Work",
  "tags": ["planning", "review"],
  "notes": "Bring the revised project outline and review next steps."
}
```

`due_date` uses the ISO `YYYY-MM-DD` format and can be `null`. `category` is optional and limited to 40 characters. `tags` is an array of up to 10 unique values, each limited to 24 characters. Send `null` for `due_date` or `category` to clear them; send an empty array to remove all tags.

`notes` is optional, defaults to an empty string, and is limited to 5,000 characters. Notes are searchable and can be changed or cleared through the task update route.

Example requests:

```bash
# Create
curl -X POST http://127.0.0.1:8000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Review project notes"}'

# Mark task 1 complete
curl -X PATCH http://127.0.0.1:8000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed":true}'

# Add a due date, category, and tags to task 1
curl -X PATCH http://127.0.0.1:8000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"due_date":"2026-10-02","category":"Work","tags":["planning","review"]}'

# Add notes to task 1
curl -X PATCH http://127.0.0.1:8000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"notes":"Bring the revised project outline and review next steps."}'
```

Invalid input returns `422`; requests for a task ID that does not exist return `404`.

## Project layout

```text
backend/
  main.py             FastAPI routes, validation, and SQLite persistence
  requirements.txt    Python dependencies
frontend/
  src/                React application and styles
  index.html          Frontend entry document
  package.json        Frontend scripts and dependencies
  package-lock.json   Locked JavaScript dependency tree
  vite.config.js      Vite server and API proxy configuration
AGENTS.md             Development instructions and project conventions
README.md             Setup and user-facing project documentation
```

## Development commands

From `frontend/`, `npm run build` creates a production bundle in `frontend/dist/`. For local development, run `npm run dev` instead.

The backend can be run with `uvicorn main:app --reload` from `backend/`. SQLite is part of Python's standard library, so it does not need a separate service.

To install backend test dependencies from the repository root, run `python -m pip install -r backend/requirements-dev.txt`, then run `python -m unittest discover -s backend -p "test_*.py"`.

## Notes

- This version is designed for one user on one machine. It does not provide authentication, synchronization, backups, or collaborative lists.
- The frontend imports Google Fonts. If network access is unavailable, the CSS system-font fallbacks are used.
- The backend's CORS allowlist is configured for the local Vite origins (`localhost:5173` and `127.0.0.1:5173`). Review it before hosting the API elsewhere.
- Startup adds the due-date, category, and tag columns to an existing SQLite database without removing existing tasks.
- Startup adds the notes column to an existing SQLite database without removing existing tasks.

## Public deployment

The repository includes a Dockerfile and a Render Blueprint for a single-service deployment. It builds the Vite frontend and serves it from FastAPI. The Blueprint uses Render's free web service and stores SQLite at `/tmp/todos.db` on its temporary filesystem. Render free services sleep after 15 minutes without traffic and take about a minute to start when visited again. **Tasks can be lost when the service sleeps, restarts, or redeploys.** This is suitable for a non-sensitive demo, not for keeping important task data. See [Render's free service limitations](https://render.com/docs/free).

The Render Blueprint does not require authentication so tutors can open the public URL directly. Anyone with the URL can view, create, edit, reorder, and delete the same tasks; do not put sensitive information in this demo. Free Render web services cannot use persistent disks, and local SQLite data is erased on spin-down, restart, or redeploy. To retain data, use a paid service with a persistent disk or a managed database; see [Render's persistent disk documentation](https://render.com/docs/disks).

Create a Render Blueprint from this repository and choose the free plan. The service will then be reachable through a public `onrender.com` URL; the first request after it sleeps may take about a minute to load.
