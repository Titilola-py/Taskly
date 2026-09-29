import sqlite3
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

from backend import main

TEST_TEMP_ROOT = Path(__file__).resolve().parent / ".test-data"
TEST_TEMP_ROOT.mkdir(exist_ok=True)


def test_database_path(name: str) -> Path:
    return TEST_TEMP_ROOT / name


class TodoNotesTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.database = test_database_path("api-test.db")
        self.original_db_path = main.DB_PATH
        main.DB_PATH = self.database
        main.init_db()
        with main.connect() as database:
            database.execute("DELETE FROM todos")
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=main.app), base_url="http://test"
        )

    async def asyncTearDown(self):
        await self.client.aclose()
        main.DB_PATH = self.original_db_path

    async def test_create_notes_update_and_reload(self):
        response = await self.client.post(
            "/api/todos",
            json={"title": "  Prepare demo  ", "notes": "  Include the new notes feature.\nReview edge cases.  "},
        )
        self.assertEqual(response.status_code, 201)
        task = response.json()
        self.assertEqual(task["title"], "Prepare demo")
        self.assertEqual(task["notes"], "Include the new notes feature.\nReview edge cases.")

        updated = await self.client.patch(
            f"/api/todos/{task['id']}", json={"notes": "Updated details"}
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["notes"], "Updated details")

        reloaded = await self.client.get("/api/todos")
        self.assertEqual(reloaded.status_code, 200)
        self.assertEqual(reloaded.json()[0]["notes"], "Updated details")

    async def test_notes_validation(self):
        too_long = await self.client.post(
            "/api/todos", json={"title": "Note limit", "notes": "x" * 5001}
        )
        self.assertEqual(too_long.status_code, 422)
        created = await self.client.post("/api/todos", json={"title": "Valid note"})
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.json()["notes"], "")
        null_notes = await self.client.patch(
            f"/api/todos/{created.json()['id']}", json={"notes": None}
        )
        self.assertEqual(null_notes.status_code, 422)

    async def test_public_auth_challenge_and_access(self):
        with patch.dict(
            "os.environ",
            {
                "TASKLY_REQUIRE_AUTH": "true",
                "TASKLY_ACCESS_USERNAME": "taskly-user",
                "TASKLY_ACCESS_PASSWORD": "test-password",
            },
        ):
            blocked = await self.client.get("/api/todos")
            allowed = await self.client.get(
                "/api/todos", auth=("taskly-user", "test-password")
            )
            health = await self.client.get("/api/health")

        self.assertEqual(blocked.status_code, 401)
        self.assertIn("Basic", blocked.headers["www-authenticate"])
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(health.status_code, 200)


class NotesMigrationTests(unittest.TestCase):
    def test_startup_migration_preserves_existing_tasks(self):
        database = test_database_path("migration-test.db")
        with sqlite3.connect(database) as connection:
            connection.execute("DROP TABLE IF EXISTS todos")
            connection.execute("""CREATE TABLE todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                position INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT '2026-01-01T00:00:00Z'
            )""")
            connection.execute(
                "INSERT INTO todos (title, position) VALUES (?, ?)",
                ("Existing task", 0),
            )

        original_db_path = main.DB_PATH
        try:
            main.DB_PATH = database
            main.init_db()
            connection = main.connect()
            try:
                row = connection.execute("SELECT * FROM todos").fetchone()
            finally:
                connection.close()
            self.assertEqual(row["title"], "Existing task")
            self.assertEqual(row["notes"], "")
        finally:
            main.DB_PATH = original_db_path


if __name__ == "__main__":
    unittest.main()
