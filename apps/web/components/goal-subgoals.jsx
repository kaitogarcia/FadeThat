"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_SUBGOALS, MAX_SUBGOAL_TEXT, makeId } from "@/lib/goal-matrix";
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
  const total = items.length;
  const done = items.filter((item) => item.done).length;
  const next = items.find((item) => !item.done);
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
      {total ? (
        <div
          className={`${styles.peek}${interactive ? ` ${styles.peekInteractive}` : ""}`}
          title={items.map((item) => `${item.done ? "✓" : "○"} ${item.text}`).join("\n")}
          onClick={interactive ? open : undefined}
        >
          <span className={styles.peekRow}>
            <span className={styles.peekText}>{next ? next.text || "untitled" : "all done"}</span>
            <span className={styles.peekCount}>
              {done}/{total}
            </span>
          </span>
          <span className={styles.peekBar} aria-hidden="true">
            <span style={{ width: `${(done / total) * 100}%` }} />
          </span>
        </div>
      ) : null}
      {interactive ? (
        <button
          type="button"
          className={styles.openButton}
          aria-label={total ? `Sub-goals (${done} of ${total} done)` : "Add sub-goals"}
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

  const done = items.filter((item) => item.done).length;
  const full = items.length >= MAX_SUBGOALS;

  const update = (id, patch) => onChange((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const remove = (id) => onChange((list) => list.filter((item) => item.id !== id));
  const add = () => {
    const text = draft.trim().slice(0, MAX_SUBGOAL_TEXT);
    if (!text || full) {
      return;
    }
    onChange((list) => (list.length >= MAX_SUBGOALS ? list : [...list, { id: makeId(), text, done: false }]));
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
          <div className={styles.progress} aria-label={`${done} of ${items.length} done`}>
            <span className={styles.progressBar}>
              <span style={{ width: `${(done / items.length) * 100}%` }} />
            </span>
            <span>
              {done}/{items.length}
            </span>
          </div>
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id} className={`${styles.item}${item.done ? ` ${styles.itemDone}` : ""}`}>
                <input
                  type="checkbox"
                  className={styles.check}
                  checked={item.done}
                  aria-label={item.done ? "Mark not done" : "Mark done"}
                  onChange={(event) => update(item.id, { done: event.target.checked })}
                />
                <input
                  type="text"
                  className={styles.itemText}
                  value={item.text}
                  maxLength={MAX_SUBGOAL_TEXT}
                  aria-label="Sub-goal"
                  spellCheck={false}
                  onChange={(event) => update(item.id, { text: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
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
      ) : (
        <p className={styles.empty}>Break this action into smaller steps.</p>
      )}

      <form
        className={styles.add}
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <span className={styles.addMark} aria-hidden="true">
          +
        </span>
        <input
          ref={addRef}
          type="text"
          className={styles.addInput}
          value={draft}
          maxLength={MAX_SUBGOAL_TEXT}
          disabled={full}
          placeholder={full ? `limit of ${MAX_SUBGOALS} reached` : "add a sub-goal, enter to add"}
          aria-label="New sub-goal"
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>
    </div>
  );
}
