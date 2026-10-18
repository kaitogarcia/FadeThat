from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel, Field


class GoalSub(BaseModel):
    goal: str = Field(default="", max_length=400)
    actions: list[str] = Field(default_factory=list, max_length=8)


class GoalMatrix(BaseModel):
    id: str = Field(min_length=1, max_length=120)
    goal: str = Field(default="", max_length=400)
    subs: list[GoalSub] = Field(default_factory=list, max_length=8)


class GoalMatricesRequest(BaseModel):
    matrices: list[GoalMatrix] = Field(default_factory=list, max_length=100)


class GoalStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(str(self.db_path), check_same_thread=False)
        connection.row_factory = sqlite3.Row
        return connection

    def _init_db(self) -> None:
        with self._lock:
            with self._connect() as connection:
                connection.execute(
                    """
                    CREATE TABLE IF NOT EXISTS goal_matrices (
                        id TEXT PRIMARY KEY,
                        payload TEXT NOT NULL,
                        position INTEGER NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                    """
                )
                connection.commit()

    def list_matrices(self) -> list[dict]:
        with self._lock:
            with self._connect() as connection:
                rows = connection.execute(
                    "SELECT payload FROM goal_matrices ORDER BY position ASC, updated_at ASC"
                ).fetchall()

        return [json.loads(row["payload"]) for row in rows]

    def replace_matrices(self, matrices: list[dict]) -> None:
        now = datetime.now(timezone.utc).isoformat()

        with self._lock:
            with self._connect() as connection:
                connection.execute("DELETE FROM goal_matrices")

                for index, matrix in enumerate(matrices):
                    connection.execute(
                        """
                        INSERT INTO goal_matrices (id, payload, position, updated_at)
                        VALUES (?, ?, ?, ?)
                        """,
                        (matrix["id"], json.dumps(matrix), index, now),
                    )

                connection.commit()


def build_goal_store() -> GoalStore:
    # Share the board's database file so one volume covers both.
    configured_path = os.getenv("GOALS_DB_PATH", "").strip() or os.getenv("BOARD_DB_PATH", "").strip()
    if configured_path:
        db_path = Path(configured_path).expanduser()
    else:
        service_dir = Path(__file__).resolve().parent.parent
        db_path = service_dir / "runtime" / "board.db"

    return GoalStore(db_path)


def normalize_matrix(matrix: GoalMatrix) -> dict:
    subs = [
        {
            "goal": sub.goal,
            "actions": (sub.actions + [""] * 8)[:8],
        }
        for sub in matrix.subs
    ]
    subs += [{"goal": "", "actions": [""] * 8} for _ in range(8 - len(subs))]

    return {"id": matrix.id, "goal": matrix.goal, "subs": subs[:8]}


goal_store = build_goal_store()
router = APIRouter()


@router.get("/api/goals/matrices")
def get_goal_matrices() -> dict:
    return {"matrices": goal_store.list_matrices()}


@router.put("/api/goals/matrices")
def put_goal_matrices(body: GoalMatricesRequest) -> dict:
    normalized: list[dict] = []
    seen_ids: set[str] = set()

    for matrix in body.matrices:
        if matrix.id in seen_ids:
            continue

        seen_ids.add(matrix.id)
        normalized.append(normalize_matrix(matrix))

    goal_store.replace_matrices(normalized)
    return {"matrices": goal_store.list_matrices()}
