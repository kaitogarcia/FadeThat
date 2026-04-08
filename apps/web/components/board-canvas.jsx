"use client";

import { useEffect, useRef, useState } from "react";

const PASTEL_COLORS = ["#b9d6ff", "#fff3a8", "#ffd6a5", "#ffc1d5", "#d6c2ff"];
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

function buildApiUrl(path) {
  if (!apiBaseUrl) {
    return path;
  }
  return `${apiBaseUrl}${path}`;
}

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeNote(raw, index) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const width = Number(raw.width);
  const height = Number(raw.height);

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : makeId(),
    text: typeof raw.text === "string" ? raw.text : "",
    color:
      typeof raw.color === "string" && raw.color
        ? raw.color
        : PASTEL_COLORS[index % PASTEL_COLORS.length],
    width: Number.isFinite(width) ? Math.max(180, Math.round(width)) : 250,
    height: Number.isFinite(height) ? Math.max(180, Math.round(height)) : 250,
  };
}

export default function BoardCanvas() {
  const [notes, setNotes] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveState, setSaveState] = useState("idle");

  const saveTimerRef = useRef(null);

  useEffect(() => {
    let ignore = false;

    async function loadNotes() {
      try {
        const response = await fetch(buildApiUrl("/api/board/notes"), {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Could not load notes (${response.status}).`);
        }

        const payload = await response.json();
        const incoming = Array.isArray(payload.notes) ? payload.notes : [];
        const normalized = incoming
          .map((item, index) => normalizeNote(item, index))
          .filter(Boolean);

        if (!ignore) {
          setNotes(normalized);
          setLoadError("");
        }
      } catch (error) {
        if (!ignore) {
          setLoadError(error?.message || "Could not load board notes.");
          setNotes([]);
        }
      } finally {
        if (!ignore) {
          setIsLoaded(true);
        }
      }
    }

    loadNotes();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return undefined;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    setSaveState("saving");

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch(buildApiUrl("/api/board/notes"), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notes }),
        });

        if (!response.ok) {
          throw new Error(`Could not save notes (${response.status}).`);
        }

        setSaveState("saved");
        setSaveError("");
      } catch (error) {
        setSaveState("error");
        setSaveError(error?.message || "Could not save notes.");
      }
    }, 450);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [notes, isLoaded]);

  const addNote = () => {
    setNotes((current) => {
      const nextColor = PASTEL_COLORS[current.length % PASTEL_COLORS.length];
      return [
        ...current,
        {
          id: makeId(),
          text: "",
          color: nextColor,
          width: 250,
          height: 250,
        },
      ];
    });
  };

  const updateNoteText = (noteId, text) => {
    setNotes((current) =>
      current.map((note) => (note.id === noteId ? { ...note, text } : note))
    );
  };

  const updateNoteSize = (noteId, nextWidth, nextHeight) => {
    setNotes((current) =>
      current.map((note) => {
        if (note.id !== noteId) {
          return note;
        }

        return {
          ...note,
          width: Math.max(180, Math.round(nextWidth)),
          height: Math.max(180, Math.round(nextHeight)),
        };
      })
    );
  };

  const handleResizeCommit = (noteId, event) => {
    const node = event.currentTarget;
    updateNoteSize(noteId, node.offsetWidth, node.offsetHeight);
  };

  return (
    <section className="board-wrap" aria-label="Sticky board">
      <h1 className="board-title">BOARD</h1>

      <button className="board-plus" type="button" onClick={addNote} aria-label="Add sticky note">
        +
      </button>

      <p className="board-save-state" role="status">
        {loadError
          ? `Load error: ${loadError}`
          : saveError
            ? `Save error: ${saveError}`
            : saveState === "saving"
              ? "Saving board..."
              : saveState === "saved"
                ? "Saved"
                : "Ready"}
      </p>

      {isLoaded && notes.length === 0 ? (
        <p className="board-empty">Click the + button to create your first sticky note.</p>
      ) : null}

      <div className="board-notes-area">
        {notes.map((note) => (
          <textarea
            key={note.id}
            className="board-note"
            style={{ backgroundColor: note.color, width: `${note.width}px`, height: `${note.height}px` }}
            value={note.text}
            onChange={(event) => updateNoteText(note.id, event.target.value)}
            onMouseUp={(event) => handleResizeCommit(note.id, event)}
            onTouchEnd={(event) => handleResizeCommit(note.id, event)}
            placeholder="Write here..."
          />
        ))}
      </div>
    </section>
  );
}
