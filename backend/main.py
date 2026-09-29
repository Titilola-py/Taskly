from __future__ import annotations

import os
import json
import sqlite3
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException, Path as PathParam, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

DEFAULT_DB = Path(__file__).resolve().parent / "todos.db"
DB_PATH = Path(os.getenv("TODO_DATABASE_PATH", str(DEFAULT_DB)))


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys = ON")
    return db


def init_db() -> None:
    with connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 240),
            completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
            position INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            due_date TEXT,
            category TEXT,
            tags TEXT NOT NULL DEFAULT '[]'
        )""")
        columns = {row["name"] for row in db.execute("PRAGMA table_info(todos)")}
        if "due_date" not in columns:
            db.execute("ALTER TABLE todos ADD COLUMN due_date TEXT")
        if "category" not in columns:
            db.execute("ALTER TABLE todos ADD COLUMN category TEXT")
        if "tags" not in columns:
            db.execute("ALTER TABLE todos ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Todo API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class TodoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    due_date: date | None = None
    category: str | None = Field(default=None, max_length=40)
    tags: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be blank")
        return value

    @field_validator("category")
    @classmethod
    def clean_category(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for value in values:
            tag = value.strip()
            if not tag:
                continue
            if len(tag) > 24:
                raise ValueError("Tags must be 24 characters or fewer")
            if tag.casefold() not in seen:
                seen.add(tag.casefold())
                cleaned.append(tag)
        if len(cleaned) > 10:
            raise ValueError("A task can have at most 10 tags")
        return cleaned


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    completed: bool | None = None
    due_date: date | None = None
    category: str | None = Field(default=None, max_length=40)
    tags: list[str] | None = Field(default=None, max_length=10)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be blank")
        return value

    @field_validator("category")
    @classmethod
    def clean_category(cls, value: str | None) -> str | None:
        value = value.strip() if value else None
        return value or None

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        cleaned: list[str] = []
        seen: set[str] = set()
        for value in values:
            tag = value.strip()
            if not tag:
                continue
            if len(tag) > 24:
                raise ValueError("Tags must be 24 characters or fewer")
            if tag.casefold() not in seen:
                seen.add(tag.casefold())
                cleaned.append(tag)
        if len(cleaned) > 10:
            raise ValueError("A task can have at most 10 tags")
        return cleaned


class TodoOut(BaseModel):
    id: int
    title: str
    completed: bool
    position: int
    created_at: str
    due_date: date | None
    category: str | None
    tags: list[str]


def serialize(row: sqlite3.Row) -> TodoOut:
    return TodoOut(
        id=row["id"], title=row["title"], completed=bool(row["completed"]),
        position=row["position"], created_at=row["created_at"], due_date=row["due_date"],
        category=row["category"], tags=json.loads(row["tags"] or "[]"),
    )


def ordered(db: sqlite3.Connection) -> list[sqlite3.Row]:
    return db.execute("SELECT * FROM todos ORDER BY position, id").fetchall()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/todos", response_model=list[TodoOut])
def list_todos() -> list[TodoOut]:
    with connect() as db:
        return [serialize(row) for row in ordered(db)]


@app.post("/api/todos", response_model=TodoOut, status_code=201)
def create_todo(payload: TodoCreate) -> TodoOut:
    with connect() as db:
        position = db.execute("SELECT COALESCE(MAX(position), -1) + 1 FROM todos").fetchone()[0]
        cursor = db.execute(
            "INSERT INTO todos (title, position, due_date, category, tags) VALUES (?, ?, ?, ?, ?)",
            (payload.title, position, payload.due_date.isoformat() if payload.due_date else None,
             payload.category, json.dumps(payload.tags)),
        )
        row = db.execute("SELECT * FROM todos WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return serialize(row)


@app.patch("/api/todos/{todo_id}", response_model=TodoOut)
def update_todo(payload: TodoUpdate, todo_id: Annotated[int, PathParam(gt=0)]) -> TodoOut:
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    if any(value is None for key, value in changes.items() if key in {"title", "completed", "tags"}):
        raise HTTPException(status_code=422, detail="title, completed, and tags cannot be null")
    if "completed" in changes:
        changes["completed"] = int(changes["completed"])
    if "due_date" in changes:
        changes["due_date"] = changes["due_date"].isoformat() if changes["due_date"] else None
    if "tags" in changes:
        changes["tags"] = json.dumps(changes["tags"])
    columns = {"title", "completed", "due_date", "category", "tags"}
    assignments = ", ".join(f"{key} = ?" for key in changes if key in columns)
    with connect() as db:
        cursor = db.execute(f"UPDATE todos SET {assignments} WHERE id = ?", (*changes.values(), todo_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        return serialize(db.execute("SELECT * FROM todos WHERE id = ?", (todo_id,)).fetchone())


@app.post("/api/todos/{todo_id}/move", response_model=list[TodoOut])
def move_todo(todo_id: Annotated[int, PathParam(gt=0)], direction: str) -> list[TodoOut]:
    if direction not in {"up", "down"}:
        raise HTTPException(status_code=422, detail="direction must be up or down")
    with connect() as db:
        rows = ordered(db)
        index = next((i for i, row in enumerate(rows) if row["id"] == todo_id), None)
        if index is None:
            raise HTTPException(status_code=404, detail="Task not found")
        target = index + (-1 if direction == "up" else 1)
        if 0 <= target < len(rows):
            rows[index], rows[target] = rows[target], rows[index]
            # Temporary negative positions avoid transient UNIQUE conflicts if added later.
            db.executemany("UPDATE todos SET position = ? WHERE id = ?", [(-(i + 1), row["id"]) for i, row in enumerate(rows)])
            db.executemany("UPDATE todos SET position = ? WHERE id = ?", [(i, row["id"]) for i, row in enumerate(rows)])
        return [serialize(row) for row in ordered(db)]


@app.delete("/api/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: Annotated[int, PathParam(gt=0)]) -> Response:
    with connect() as db:
        cursor = db.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        rows = ordered(db)
        db.executemany("UPDATE todos SET position = ? WHERE id = ?", [(i, row["id"]) for i, row in enumerate(rows)])
    return Response(status_code=204)
