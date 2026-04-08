from __future__ import annotations

import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path


class BoardStore:
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
                    CREATE TABLE IF NOT EXISTS board_notes (
                        id TEXT PRIMARY KEY,
                        text TEXT NOT NULL,
                        color TEXT NOT NULL,
                        width INTEGER NOT NULL,
                        height INTEGER NOT NULL,
                        position INTEGER NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                    """
                )
                connection.commit()

    def list_notes(self) -> list[dict]:
        with self._lock:
            with self._connect() as connection:
                rows = connection.execute(
                    """
                    SELECT id, text, color, width, height, position
                    FROM board_notes
                    ORDER BY position ASC, updated_at ASC
                    """
                ).fetchall()

        return [
            {
                "id": row["id"],
                "text": row["text"],
                "color": row["color"],
                "width": int(row["width"]),
                "height": int(row["height"]),
            }
            for row in rows
        ]

    def replace_notes(self, notes: list[dict]) -> None:
        now = datetime.now(timezone.utc).isoformat()

        with self._lock:
            with self._connect() as connection:
                connection.execute("DELETE FROM board_notes")

                for index, note in enumerate(notes):
                    connection.execute(
                        """
                        INSERT INTO board_notes (id, text, color, width, height, position, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            note["id"],
                            note["text"],
                            note["color"],
                            int(note["width"]),
                            int(note["height"]),
                            index,
                            now,
                        ),
                    )

                connection.commit()


def build_board_store() -> BoardStore:
    configured_path = os.getenv("BOARD_DB_PATH", "").strip()
    if configured_path:
        db_path = Path(configured_path).expanduser()
    else:
        service_dir = Path(__file__).resolve().parent.parent
        db_path = service_dir / "runtime" / "board.db"

    return BoardStore(db_path)
