"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_SUBGOALS, MAX_SUBGOAL_TEXT, makeId, subgoalTasks } from "@/lib/goal-matrix";
import styles from "./goal-subgoals.module.css";

// Add to an action cell's textarea when it has sub-goals: frees the bottom edge for the peek.
export const SUBGOAL_RESERVE_CLASS = styles.reserve;

// Cmd/Ctrl + Enter in a focused action cell opens its sub-goals.
export function isSubgoalShortcut(event) {
  return (event.metaKey || event.ctrlKey) && event.key === "Enter";
}

// Wraps one action cell: an "open sub-goals" corner button, and a one-line peek of the
// sub-goals along the cell's bottom edge (the cell's textarea reserves that space).
export function ActionCellFrame({ items, interactive, isOpen, onOpen, children }) {
  const ref = useRef(null);
  const tasks = subgoalTasks(items);
  const total = tasks.length;
  const done = tasks.filter((item) => item.done).length;
  const next = tasks.find((item) => !item.done);
  const firstNote = items.find((item) => item.kind === "note");
  const open = (event) => {
    event.stopPropagation();
    onOpen(ref.current);
  };

  return (
    <div
      ref={ref}
      className={`${styles.frame}${isOpen ? ` ${styles.frameOpen}` : ""}`}
      onKeyDown={(event) => {
        if (interactive && isSubgoalShortcut(event)) {
          event.preventDefault();
          onOpen(ref.current);
        }
      }}
    >
      {children}
      {items.length ? (
        <div
          className={`${styles.peek}${interactive ? ` ${styles.peekInteractive}` : ""}`}
          title={items
            .map((item) => `${item.kind === "note" ? "–" : item.done ? "✓" : "○"} ${item.text}`)
            .join("\n")}
          onClick={interactive ? open : undefined}
        >
          <span className={styles.peekRow}>
            <span className={styles.peekText}>
              {total ? (next ? next.text || "untitled" : "all done") : firstNote.text || "note"}
            </span>
            {total ? (
              <span className={styles.peekCount}>
                {done}/{total}
              </span>
            ) : null}
          </span>
          {total ? (
            <span className={styles.peekBar} aria-hidden="true">
              <span style={{ width: `${(done / total) * 100}%` }} />
            </span>
          ) : null}
        </div>
      ) : null}
      {interactive ? (
        <button
          type="button"
          className={styles.openButton}
          aria-label={total ? `Sub-goals (${done} of ${total} done)` : items.length ? "Sub-goals" : "Add sub-goals"}
          aria-expanded={isOpen}
          title="Sub-goals (⌘↵)"
          onClick={open}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 3h8M4 6h6M4 9h6M2 6v3" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

const GAP = 10;
const EDGE = 12;

// Popover listing one action cell's sub-goals. Rendered outside the scaled world and kept
// next to its cell every frame; the parent closes it whenever the camera changes view.
export default function GoalSubgoals({ anchor, title, context, color, items, onChange, onClose }) {
  const ref = useRef(null);
  const addRef = useRef(null);
  const [draft, setDraft] = useState("");
  // What the add field creates: a checkbox goal, or a plain note row that isn't counted.
  const [addKind, setAddKind] = useState("task");
  const listRef = useRef(null);
  const [dragId, setDragId] = useState(null);

  // Follow the anchor cell (window resize, stage re-fit) without re-rendering.
  useLayoutEffect(() => {
    let frame = 0;
    let last = "";
    const place = () => {
      const node = ref.current;
      if (node && anchor?.isConnected) {
        const rect = anchor.getBoundingClientRect();
        const width = node.offsetWidth;
        const height = node.offsetHeight;
        let left = rect.right + GAP;
        if (left + width > window.innerWidth - EDGE) {
          left = rect.left - GAP - width;
        }
        left = Math.max(EDGE, Math.min(left, window.innerWidth - EDGE - width));
        const top = Math.max(EDGE, Math.min(rect.top, window.innerHeight - EDGE - height));
        const key = `${Math.round(left)},${Math.round(top)}`;
        if (key !== last) {
          last = key;
          node.style.left = `${Math.round(left)}px`;
          node.style.top = `${Math.round(top)}px`;
        }
      }
      frame = window.requestAnimationFrame(place);
    };
    place();
    return () => window.cancelAnimationFrame(frame);
  }, [anchor]);

  useEffect(() => {
    addRef.current?.focus({ preventScroll: true });
  }, [anchor]);

  // Esc closes this first (capture phase, so the page's Esc-to-zoom-out never sees it).
  // A click outside closes it; if that click landed on empty stage it is not also a zoom.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
      }
    };
    const onPointerDown = (event) => {
      const target = event.target;
      if (ref.current?.contains(target) || anchor?.contains(target)) {
        return;
      }
      onClose(false);
      if (target.closest?.(".goal-stage") && !target.closest("button, textarea, input")) {
        const swallow = (click) => {
          click.stopPropagation();
          click.preventDefault();
        };
        window.addEventListener("click", swallow, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 600);
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [anchor, onClose]);

  const tasks = subgoalTasks(items);
  const done = tasks.filter((item) => item.done).length;
  const full = items.length >= MAX_SUBGOALS;

  const update = (id, patch) => onChange((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const remove = (id) => onChange((list) => list.filter((item) => item.id !== id));
  const move = (id, to) =>
    onChange((list) => {
      const from = list.findIndex((item) => item.id === id);
      const target = Math.max(0, Math.min(list.length - 1, to));
      if (from === -1 || from === target) {
        return list;
      }
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved);
      return next;
    });

  // Dragging a row's grip: the row moves to wherever the pointer is over the list.
  const dragTo = (id, clientY) => {
    const rows = [...(listRef.current?.children || [])];
    const from = rows.findIndex((row) => row.dataset.id === id);
    let to = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    if (to === -1) {
      to = rows.length - 1;
    } else if (from !== -1 && from < to) {
      to -= 1;
    }
    if (from !== -1 && to !== from) {
      move(id, to);
    }
  };
  const add = (kind = addKind) => {
    const text = draft.trim().slice(0, MAX_SUBGOAL_TEXT);
    if (!text || full) {
      return;
    }
    onChange((list) =>
      list.length >= MAX_SUBGOALS ? list : [...list, { id: makeId(), text, done: false, kind }]
    );
    setDraft("");
  };

  return (
    <div
      ref={ref}
      className={styles.popover}
      role="dialog"
      aria-label={`Sub-goals of ${title || "action"}`}
      style={color ? { "--subgoal-tint": color } : undefined}
    >
      <header className={styles.header}>
        <div className={styles.headerText}>
          {context ? (
            <p className={styles.context}>
              <span className={styles.contextText}>{context}</span>
            </p>
          ) : null}
          <h3 className={`${styles.title}${title ? "" : ` ${styles.titleEmpty}`}`}>{title || "untitled action"}</h3>
        </div>
        <button type="button" className={styles.close} aria-label="Close sub-goals" onClick={() => onClose(true)}>
          ×
        </button>
      </header>

      {items.length ? (
        <>
          {tasks.length ? (
            <div className={styles.progress} aria-label={`${done} of ${tasks.length} done`}>
              <span className={styles.progressBar}>
                <span style={{ width: `${(done / tasks.length) * 100}%` }} />
              </span>
              <span>
                {done}/{tasks.length}
              </span>
            </div>
          ) : null}
          <ul className={styles.list} ref={listRef}>
            {items.map((item, index) => (
              <li
                key={item.id}
                data-id={item.id}
                className={`${styles.item}${item.done ? ` ${styles.itemDone}` : ""}${
                  item.kind === "note" ? ` ${styles.itemNote}` : ""
                }${dragId === item.id ? ` ${styles.itemDragging}` : ""}`}
              >
                <button
                  type="button"
                  className={styles.grip}
                  aria-label="Drag to reorder (or Alt + arrow keys)"
                  tabIndex={-1}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    try {
                      event.currentTarget.setPointerCapture(event.pointerId);
                    } catch {
                      // No active pointer to capture (e.g. synthetic events); moves still track.
                    }
                    setDragId(item.id);
                  }}
                  onPointerMove={(event) => {
                    if (dragId === item.id) {
                      dragTo(item.id, event.clientY);
                    }
                  }}
                  onPointerUp={() => setDragId(null)}
                  onPointerCancel={() => setDragId(null)}
                >
                  <svg viewBox="0 0 8 12" aria-hidden="true">
                    <circle cx="2" cy="2" r="1" />
                    <circle cx="6" cy="2" r="1" />
                    <circle cx="2" cy="6" r="1" />
                    <circle cx="6" cy="6" r="1" />
                    <circle cx="2" cy="10" r="1" />
                    <circle cx="6" cy="10" r="1" />
                  </svg>
                </button>
                {item.kind === "note" ? (
                  <span className={styles.noteMark} aria-hidden="true">
                    –
                  </span>
                ) : (
                  <input
                    type="checkbox"
                    className={styles.check}
                    checked={item.done}
                    aria-label={item.done ? "Mark not done" : "Mark done"}
                    onChange={(event) => update(item.id, { done: event.target.checked })}
                  />
                )}
                <input
                  type="text"
                  className={styles.itemText}
                  value={item.text}
                  maxLength={MAX_SUBGOAL_TEXT}
                  aria-label={item.kind === "note" ? "Note" : "Sub-goal"}
                  spellCheck={false}
                  onChange={(event) => update(item.id, { text: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
                      // Alt + ↑/↓ moves the row; keep focus on it as it moves.
                      event.preventDefault();
                      const input = event.currentTarget;
                      move(item.id, index + (event.key === "ArrowUp" ? -1 : 1));
                      window.requestAnimationFrame(() => input.focus());
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      addRef.current?.focus();
                    } else if (event.key === "Backspace" && !item.text) {
                      event.preventDefault();
                      remove(item.id);
                      addRef.current?.focus();
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.remove}
                  aria-label="Delete sub-goal"
                  onClick={() => remove(item.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <form
        className={styles.add}
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <button
          type="button"
          className={styles.kindToggle}
          aria-pressed={addKind === "note"}
          aria-label={addKind === "note" ? "Adding notes; switch to checkbox goals" : "Adding checkbox goals; switch to notes"}
          title={addKind === "note" ? "note (not counted)" : "checkbox goal"}
          onClick={() => {
            setAddKind((kind) => (kind === "note" ? "task" : "note"));
            addRef.current?.focus();
          }}
        >
          {addKind === "note" ? "–" : "☐"}
        </button>
        <input
          ref={addRef}
          type="text"
          className={styles.addInput}
          value={draft}
          maxLength={MAX_SUBGOAL_TEXT}
          disabled={full}
          placeholder={
            full
              ? `limit of ${MAX_SUBGOALS} reached`
              : addKind === "note"
                ? "add a note (not counted), enter to add"
                : "add a sub-goal · shift+enter for a note"
          }
          aria-label={addKind === "note" ? "New note" : "New sub-goal"}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Shift+Enter adds a note without switching modes.
            if (event.key === "Enter" && event.shiftKey) {
              event.preventDefault();
              add("note");
            }
          }}
        />
      </form>
    </div>
  );
}
