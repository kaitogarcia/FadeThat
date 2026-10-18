"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { emptyMatrix, normalizeCalendar, normalizeMatrices } from "@/lib/goal-matrix";
import GoalCalendar from "@/components/goal-calendar";

// Unsaved edits are kept in the browser until Save commits them to the repo.
const LOCAL_KEY = "fadethat-goal-matrices-draft";
const SUB_COLORS = ["#b9d6ff", "#fff3a8", "#ffd6a5", "#ffc1d5", "#d6c2ff", "#c4f0d2", "#ffe0f0", "#d2ecff"];
// The 8 positions around the center of a 3x3 grid, in reading order.
const RING = [0, 1, 2, 3, 5, 6, 7, 8];
const ZOOM_MS = 720;

// Draft = { baseSavedAt, matrices, calendar }: edits made on top of the saved version from `baseSavedAt`.
function readDraft() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "null");
    if (!parsed || !Array.isArray(parsed.matrices)) {
      return null;
    }
    return {
      baseSavedAt: Number(parsed.baseSavedAt) || 0,
      matrices: normalizeMatrices(parsed.matrices),
      calendar: parsed.calendar ? normalizeCalendar(parsed.calendar) : null,
    };
  } catch {
    return null;
  }
}

function writeDraft(draft) {
  try {
    if (draft) {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(draft));
    } else {
      window.localStorage.removeItem(LOCAL_KEY);
    }
  } catch {
    // Private mode or full storage: edits still save with the Save button.
  }
}

// Position of `el` inside the (possibly mid-animation) world, in unscaled world units.
function worldRect(world, el) {
  const wr = world.getBoundingClientRect();
  const scale = wr.width / world.offsetWidth || 1;
  const er = el.getBoundingClientRect();
  return {
    x: (er.left - wr.left) / scale,
    y: (er.top - wr.top) / scale,
    w: er.width / scale,
    h: er.height / scale,
  };
}

function Cell({ value, onChange, placeholder, kind, color, interactive, onFocus }) {
  return (
    <textarea
      className={`goal-cell goal-cell-${kind}`}
      style={color ? { backgroundColor: color } : undefined}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
      tabIndex={interactive ? 0 : -1}
      spellCheck={false}
    />
  );
}

function MatrixChart({ matrix, interactive, onEdit, onBlockClick, onCellFocus, registerBlock }) {
  return (
    <div className="goal-chart">
      {Array.from({ length: 9 }, (_, block) => {
        const isCore = block === 4;
        const sub = isCore ? null : RING.indexOf(block);
        const tint = isCore ? undefined : `${SUB_COLORS[sub]}66`;

        return (
          <div
            className={`goal-block${isCore ? " goal-block-core" : ""}`}
            key={block}
            data-block={block}
            ref={(node) => registerBlock(block, node)}
            style={tint ? { backgroundColor: tint } : undefined}
            onClick={(event) => {
              if (event.target.tagName !== "TEXTAREA") {
                event.stopPropagation();
                onBlockClick(block);
              }
            }}
          >
            {Array.from({ length: 9 }, (_, pos) => {
              const focus = () => onCellFocus(block);

              if (isCore && pos === 4) {
                return (
                  <Cell
                    key={pos}
                    kind="main"
                    value={matrix.goal}
                    placeholder="main goal"
                    interactive={interactive}
                    onFocus={focus}
                    onChange={(value) => onEdit((m) => ({ ...m, goal: value }))}
                  />
                );
              }

              if (isCore || pos === 4) {
                // Core ring cell and outer block center both edit the same sub-goal.
                const k = isCore ? RING.indexOf(pos) : sub;
                return (
                  <Cell
                    key={pos}
                    kind="sub"
                    color={SUB_COLORS[k]}
                    value={matrix.subs[k].goal}
                    placeholder={`sub-goal ${k + 1}`}
                    interactive={interactive}
                    onFocus={focus}
                    onChange={(value) =>
                      onEdit((m) => ({
                        ...m,
                        subs: m.subs.map((s, i) => (i === k ? { ...s, goal: value } : s)),
                      }))
                    }
                  />
                );
              }

              const a = RING.indexOf(pos);
              return (
                <Cell
                  key={pos}
                  kind="action"
                  value={matrix.subs[sub].actions[a]}
                  placeholder="action"
                  interactive={interactive}
                  onFocus={focus}
                  onChange={(value) =>
                    onEdit((m) => ({
                      ...m,
                      subs: m.subs.map((s, i) =>
                        i === sub ? { ...s, actions: s.actions.map((x, j) => (j === a ? value : x)) } : s
                      ),
                    }))
                  }
                />
              );
            })}

            {!isCore || interactive ? (
              <button
                className="goal-block-zoom"
                type="button"
                tabIndex={interactive ? 0 : -1}
                aria-label="Zoom into block"
                onClick={(event) => {
                  event.stopPropagation();
                  onBlockClick(block);
                }}
              >
                +
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function GoalMatrices({ initialData }) {
  const initialSavedAt = Number(initialData?.savedAt) || 0;
  const [matrices, setMatrices] = useState(() => normalizeMatrices(initialData?.matrices));
  const [calendar, setCalendar] = useState(() => normalizeCalendar(initialData?.calendar));
  const [isLoaded, setIsLoaded] = useState(false);
  // clean | dirty | saving | saved | error
  const [saveState, setSaveState] = useState("clean");
  const [saveMessage, setSaveMessage] = useState("");
  // level 0 = all matrices, 1 = one matrix, 2 = one block of a matrix
  const [view, setView] = useState({ level: 0, matrixId: null, block: null });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const stageRef = useRef(null);
  const worldRef = useRef(null);
  const cardRefs = useRef(new Map());
  const blockRefs = useRef(new Map());
  const animateRef = useRef(false);
  const savedRef = useRef({ savedAt: initialSavedAt, json: JSON.stringify({ matrices, calendar }) });
  const wheelRef = useRef({ acc: 0, lockedUntil: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const activeMatrix = matrices.find((m) => m.id === view.matrixId) || null;

  // Restore unsaved edits, unless a newer save has been deployed since they were made.
  useEffect(() => {
    const draft = readDraft();
    if (draft && draft.baseSavedAt >= initialSavedAt) {
      setMatrices(draft.matrices);
      if (draft.calendar) {
        setCalendar(draft.calendar);
      }
    } else {
      writeDraft(null);
    }
    setIsLoaded(true);
  }, [initialSavedAt]);

  // Track unsaved changes and keep a browser draft of them.
  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    const dirty = JSON.stringify({ matrices, calendar }) !== savedRef.current.json;
    writeDraft(dirty ? { baseSavedAt: savedRef.current.savedAt, matrices, calendar } : null);
    setSaveState((state) => (state === "saving" ? state : dirty ? "dirty" : state === "dirty" ? "clean" : state));
  }, [matrices, calendar, isLoaded]);

  const docRef = useRef({ matrices, calendar });
  docRef.current = { matrices, calendar };

  const save = useCallback(async () => {
    const snapshot = docRef.current;
    const json = JSON.stringify(snapshot);
    setSaveState("saving");
    setSaveMessage("");
    try {
      const response = await fetch("/api/goals/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Save failed (${response.status}).`);
      }
      savedRef.current = { savedAt: payload.savedAt, json };
      const stillDirty = JSON.stringify(docRef.current) !== json;
      writeDraft(stillDirty ? { baseSavedAt: payload.savedAt, ...docRef.current } : null);
      setSaveState(stillDirty ? "dirty" : "saved");
      setSaveMessage(payload.mode === "github" ? "saved to code · live in about a minute" : "saved to data/goals.json");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error.message || "Save failed.");
    }
  }, []);

  // Cmd/Ctrl + S saves.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Camera: fit the current target into the stage.
  const placeCamera = useCallback((animate) => {
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!stage || !world) {
      return;
    }

    const { level, matrixId, block } = viewRef.current;
    let target = { x: 0, y: 0, w: world.offsetWidth, h: world.offsetHeight };
    let pad = 48;

    const card = matrixId ? cardRefs.current.get(matrixId) : null;
    const blockEl = matrixId ? blockRefs.current.get(`${matrixId}:${block}`) : null;
    if (level === 2 && blockEl) {
      target = worldRect(world, blockEl);
      pad = 28;
    } else if (level >= 1 && card) {
      target = worldRect(world, card);
      pad = 24;
    }

    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    let scale = Math.min((sw - pad * 2) / target.w, (sh - pad * 2) / target.h);
    if (level === 0) {
      scale = Math.min(scale, 1);
    }
    const tx = sw / 2 - (target.x + target.w / 2) * scale;
    const ty = sh / 2 - (target.y + target.h / 2) * scale;

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    world.style.transition =
      animate && !reduceMotion ? `transform ${ZOOM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none";
    world.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }, []);

  useLayoutEffect(() => {
    placeCamera(animateRef.current);
    animateRef.current = true;
  }, [view, matrices.length, isLoaded, placeCamera]);

  // Re-fit when the stage changes size (window resize, calendar column wrapping).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const observer = new ResizeObserver(() => placeCamera(false));
    observer.observe(stage);
    return () => observer.disconnect();
  }, [placeCamera]);

  const zoomOut = useCallback(() => {
    setConfirmDelete(false);
    setView((v) => {
      if (v.level === 2) {
        return { ...v, level: 1, block: null };
      }
      return { level: 0, matrixId: null, block: null };
    });
  }, []);

  const openMatrix = (matrixId) => {
    setConfirmDelete(false);
    setView({ level: 1, matrixId, block: null });
  };

  const openBlock = (matrixId, block) => {
    setConfirmDelete(false);
    setView({ level: 2, matrixId, block });
  };

  const addMatrix = () => {
    const matrix = emptyMatrix();
    setMatrices((current) => [...current, matrix]);
    setView({ level: 1, matrixId: matrix.id, block: null });
    window.setTimeout(() => {
      const card = cardRefs.current.get(matrix.id);
      card?.querySelector(".goal-cell-main")?.focus({ preventScroll: true });
    }, ZOOM_MS);
  };

  const deleteMatrix = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const id = view.matrixId;
    setConfirmDelete(false);
    setView({ level: 0, matrixId: null, block: null });
    setMatrices((current) => current.filter((m) => m.id !== id));
  };

  const editMatrix = (matrixId, update) => {
    setMatrices((current) => current.map((m) => (m.id === matrixId ? update(m) : m)));
  };

  // Tabbing into a block outside the current view pans the camera to it.
  const handleCellFocus = (matrixId, block) => {
    const v = viewRef.current;
    if (v.level === 2 && (v.matrixId !== matrixId || v.block !== block)) {
      setView({ level: 2, matrixId, block });
    }
  };

  // Esc zooms out.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      if (document.activeElement?.tagName === "TEXTAREA") {
        document.activeElement.blur();
      }
      zoomOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomOut]);

  // Wheel / trackpad pinch: one zoom step per gesture.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return undefined;
    }

    const onWheel = (event) => {
      event.preventDefault();
      const state = wheelRef.current;
      const now = Date.now();
      if (now < state.lockedUntil) {
        return;
      }
      state.acc += event.deltaY;
      if (Math.abs(state.acc) < 40) {
        return;
      }
      const zoomingIn = state.acc < 0;
      state.acc = 0;
      state.lockedUntil = now + ZOOM_MS * 0.7;

      if (!zoomingIn) {
        zoomOut();
        return;
      }
      const v = viewRef.current;
      const card = event.target.closest?.("[data-matrix-id]");
      const blockEl = event.target.closest?.("[data-block]");
      if (v.level === 0 && card) {
        openMatrix(card.dataset.matrixId);
      } else if (v.level === 1 && blockEl && card) {
        openBlock(card.dataset.matrixId, Number(blockEl.dataset.block));
      }
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomOut]);

  const subGoalLabel =
    activeMatrix && view.level === 2
      ? view.block === 4
        ? "core"
        : activeMatrix.subs[RING.indexOf(view.block)].goal || `sub-goal ${RING.indexOf(view.block) + 1}`
      : null;

  return (
    <section className="goal-wrap" aria-label="Goal matrices">
      <GoalCalendar calendar={calendar} onChange={setCalendar} />

      <div className="goal-main">
      <div className="goal-hud goal-hud-top">
        <nav className="goal-crumbs" aria-label="Zoom level">
          <button type="button" onClick={() => setView({ level: 0, matrixId: null, block: null })}>
            goals
          </button>
          {activeMatrix ? (
            <>
              <span aria-hidden="true">/</span>
              <button type="button" onClick={() => openMatrix(activeMatrix.id)}>
                {activeMatrix.goal || "untitled"}
              </button>
            </>
          ) : null}
          {subGoalLabel ? (
            <>
              <span aria-hidden="true">/</span>
              <span className="goal-crumb-current">{subGoalLabel}</span>
            </>
          ) : null}
        </nav>

        <div className="goal-actions">
          {view.level === 1 ? (
            <button
              type="button"
              className={confirmDelete ? "goal-danger" : undefined}
              onClick={deleteMatrix}
              onBlur={() => setConfirmDelete(false)}
            >
              {confirmDelete ? "really delete?" : "delete"}
            </button>
          ) : null}
          <button type="button" onClick={addMatrix}>
            + new
          </button>
          <button
            type="button"
            className={saveState === "dirty" || saveState === "error" ? "goal-save is-dirty" : "goal-save"}
            onClick={save}
            disabled={saveState === "saving"}
          >
            {saveState === "saving" ? "saving..." : "save"}
          </button>
          <button type="button" onClick={zoomOut} disabled={view.level === 0} aria-label="Zoom out">
            −
          </button>
        </div>
      </div>

      <div
        className="goal-stage"
        ref={stageRef}
        onClick={(event) => {
          if (event.target === event.currentTarget || event.target === worldRef.current) {
            zoomOut();
          }
        }}
        onScroll={(event) => {
          // Focusing a cell can scroll the stage; the camera owns positioning.
          event.currentTarget.scrollTop = 0;
          event.currentTarget.scrollLeft = 0;
        }}
      >
        <div
          className={`goal-world${view.level === 0 ? " is-overview" : ""}`}
          ref={worldRef}
          style={{ "--goal-cols": Math.max(1, Math.ceil(Math.sqrt(matrices.length + 1))) }}
        >
          {matrices.map((matrix) => {
            const interactive = view.level > 0 && view.matrixId === matrix.id;
            return (
              <div
                className={`goal-card${interactive ? " is-active" : ""}`}
                key={matrix.id}
                data-matrix-id={matrix.id}
                ref={(node) => {
                  if (node) cardRefs.current.set(matrix.id, node);
                  else cardRefs.current.delete(matrix.id);
                }}
                onClick={() => {
                  if (!interactive) {
                    openMatrix(matrix.id);
                  }
                }}
              >
                <MatrixChart
                  matrix={matrix}
                  interactive={interactive}
                  onEdit={(update) => editMatrix(matrix.id, update)}
                  onBlockClick={(block) => {
                    if (interactive) {
                      openBlock(matrix.id, block);
                    } else {
                      openMatrix(matrix.id);
                    }
                  }}
                  onCellFocus={(block) => handleCellFocus(matrix.id, block)}
                  registerBlock={(block, node) => {
                    const key = `${matrix.id}:${block}`;
                    if (node) blockRefs.current.set(key, node);
                    else blockRefs.current.delete(key);
                  }}
                />
                <p className="goal-card-title">{matrix.goal || "untitled"}</p>
              </div>
            );
          })}

          <button
            className="goal-card goal-card-add"
            type="button"
            onClick={addMatrix}
            tabIndex={view.level === 0 ? 0 : -1}
          >
            <span aria-hidden="true">+</span>
            new goal matrix
          </button>
        </div>
      </div>

      <div className="goal-hud goal-hud-bottom">
        <p>
          {view.level === 0
            ? "click a matrix to zoom in · scroll to zoom"
            : view.level === 1
              ? "type in any cell · click a block to zoom in · esc to zoom out"
              : "type in any cell · click a nearby block to pan · esc to zoom out"}
        </p>
        <p role="status" className={saveState === "error" ? "goal-save-error" : undefined}>
          {saveState === "saving"
            ? "saving..."
            : saveState === "dirty"
              ? "unsaved changes · ⌘S to save"
              : saveState === "error"
                ? `not saved: ${saveMessage}`
                : saveState === "saved"
                  ? saveMessage
                  : "all changes saved"}
        </p>
      </div>
      </div>
    </section>
  );
}
