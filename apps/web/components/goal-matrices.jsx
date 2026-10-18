"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  IMAGE_ID_PATTERN,
  MAX_IMAGES,
  MAX_NOTES,
  emptyMatrix,
  imagePath,
  makeId,
  normalizeCalendar,
  normalizeMatrices,
} from "@/lib/goal-matrix";
import GoalCalendar from "@/components/goal-calendar";

// Unsaved edits are kept in the browser until Save commits them to the repo.
const LOCAL_KEY = "fadethat-goal-matrices-draft";
const NOTES_COLLAPSED_KEY = "fadethat-goal-notes-collapsed";
const SUB_COLORS = ["#b9d6ff", "#fff3a8", "#ffd6a5", "#ffc1d5", "#d6c2ff", "#c4f0d2", "#ffe0f0", "#d2ecff"];
// The 8 positions around the center of a 3x3 grid, in reading order.
const RING = [0, 1, 2, 3, 5, 6, 7, 8];
const ZOOM_MS = 720;

const MAX_IMAGE_EDGE = 1600;

// Shrink a pasted image in the browser before it is saved: webp where supported, jpeg otherwise.
async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const toBlob = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob("image/webp", 0.82);
  let ext = "webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await toBlob("image/jpeg", 0.85);
    ext = "jpg";
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return { ext, dataUrl };
}

function imageFiles(list) {
  return [...(list || [])]
    .map((item) => (item instanceof File ? item : item.kind === "file" ? item.getAsFile() : null))
    .filter((file) => file && file.type.startsWith("image/"));
}

// Draft = { baseSavedAt, matrices, calendar, images }: edits made on top of the saved version from
// `baseSavedAt`. `images` holds pasted images (id -> data URL) that have not been saved yet.
function readDraft() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "null");
    if (!parsed || !Array.isArray(parsed.matrices)) {
      return null;
    }
    const images = {};
    for (const [id, src] of Object.entries(parsed.images || {})) {
      if (IMAGE_ID_PATTERN.test(id) && typeof src === "string" && src.startsWith("data:image/")) {
        images[id] = src;
      }
    }
    return {
      baseSavedAt: Number(parsed.baseSavedAt) || 0,
      matrices: normalizeMatrices(parsed.matrices),
      calendar: parsed.calendar ? normalizeCalendar(parsed.calendar) : null,
      images,
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

// Starting font size per cell kind (matches the CSS) and the smallest it may shrink to.
const CELL_FONT = { main: 17, sub: 14, action: 14 };
// Cells are small in world units; zoomed into a block, 4.5px still reads at ~10px on screen.
const MIN_CELL_FONT = 4.5;

function overflows(el) {
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}

// Largest font size (0.5px steps) at which the text fits without splitting words.
function fitCellText(el, base) {
  el.style.overflowWrap = "normal";
  el.style.padding = "";
  el.style.fontSize = `${base}px`;
  if (!el.value || !overflows(el)) {
    return;
  }
  // Tighter padding buys room for long words before shrinking.
  el.style.padding = "3px";
  if (!overflows(el)) {
    return;
  }
  let lo = MIN_CELL_FONT;
  let hi = base;
  while (hi - lo > 0.5) {
    const mid = Math.round(((lo + hi) / 2) * 2) / 2;
    el.style.fontSize = `${mid}px`;
    if (overflows(el)) hi = mid;
    else lo = mid;
  }
  el.style.fontSize = `${lo}px`;
  // A single word too long even at the smallest size: let it break as a last resort.
  if (overflows(el)) {
    el.style.overflowWrap = "anywhere";
  }
}

function Cell({ value, onChange, placeholder, kind, color, interactive, onFocus }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    if (ref.current) {
      fitCellText(ref.current, CELL_FONT[kind]);
    }
  }, [value, kind]);

  return (
    <textarea
      ref={ref}
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
  // Pasted images not saved yet (id -> data URL), and ones saved this session but maybe not deployed.
  const [pendingImages, setPendingImages] = useState({});
  const [sessionImages, setSessionImages] = useState({});
  const [lightbox, setLightbox] = useState(null);
  // Matrix ids whose notes panel is collapsed; a per-browser view preference, not saved data.
  const [collapsedNotes, setCollapsedNotes] = useState(() => new Set());

  useEffect(() => {
    try {
      const ids = JSON.parse(window.localStorage.getItem(NOTES_COLLAPSED_KEY) || "[]");
      if (Array.isArray(ids)) {
        setCollapsedNotes(new Set(ids.filter((id) => typeof id === "string")));
      }
    } catch {
      // Storage unavailable: every notes panel starts open.
    }
  }, []);

  const toggleNotes = (matrixId) => {
    setCollapsedNotes((current) => {
      const next = new Set(current);
      if (next.has(matrixId)) next.delete(matrixId);
      else next.add(matrixId);
      try {
        window.localStorage.setItem(NOTES_COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        // Storage unavailable: the toggle still works for this visit.
      }
      return next;
    });
  };

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
      setPendingImages(draft.images);
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
    writeDraft(dirty ? { baseSavedAt: savedRef.current.savedAt, matrices, calendar, images: pendingImages } : null);
    setSaveState((state) => (state === "saving" ? state : dirty ? "dirty" : state === "dirty" ? "clean" : state));
  }, [matrices, calendar, pendingImages, isLoaded]);

  const docRef = useRef({ matrices, calendar });
  docRef.current = { matrices, calendar };
  const pendingRef = useRef(pendingImages);
  pendingRef.current = pendingImages;

  const save = useCallback(async () => {
    const snapshot = docRef.current;
    const json = JSON.stringify(snapshot);
    // Send only unsaved images the notes still use.
    const used = new Set(snapshot.matrices.flatMap((m) => m.images.map((image) => image.id)));
    const sent = Object.fromEntries(Object.entries(pendingRef.current).filter(([id]) => used.has(id)));
    setSaveState("saving");
    setSaveMessage("");
    try {
      const response = await fetch("/api/goals/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...snapshot,
          images: Object.fromEntries(Object.entries(sent).map(([id, src]) => [id, src.split(",")[1]])),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Save failed (${response.status}).`);
      }
      savedRef.current = { savedAt: payload.savedAt, json };
      // Keep showing saved images from memory until the redeploy serves them.
      setSessionImages((current) => ({ ...current, ...sent }));
      const remaining = Object.fromEntries(Object.entries(pendingRef.current).filter(([id]) => !(id in sent)));
      setPendingImages(remaining);
      const stillDirty = JSON.stringify(docRef.current) !== json;
      writeDraft(stillDirty ? { baseSavedAt: payload.savedAt, ...docRef.current, images: remaining } : null);
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
  }, [view, matrices.length, isLoaded, collapsedNotes, placeCamera]);

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

  // Pasted or dropped images: shrink, keep as unsaved, and attach to the matrix's notes.
  const addImages = async (matrixId, files) => {
    for (const file of files) {
      try {
        const { ext, dataUrl } = await compressImage(file);
        const id = makeId();
        setPendingImages((current) => ({ ...current, [id]: dataUrl }));
        editMatrix(matrixId, (m) =>
          m.images.length >= MAX_IMAGES ? m : { ...m, images: [...m.images, { id, ext }] }
        );
      } catch {
        setSaveState("error");
        setSaveMessage("Could not read the pasted image.");
      }
    }
  };

  // Tabbing into a block outside the current view pans the camera to it.
  const handleCellFocus = (matrixId, block) => {
    const v = viewRef.current;
    if (v.level === 2 && (v.matrixId !== matrixId || v.block !== block)) {
      setView({ level: 2, matrixId, block });
    }
  };

  // Esc closes an open image first, then zooms out.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      if (lightbox) {
        setLightbox(null);
        return;
      }
      if (document.activeElement?.tagName === "TEXTAREA") {
        document.activeElement.blur();
      }
      zoomOut();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomOut, lightbox]);

  // Wheel / trackpad pinch: one zoom step per gesture.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return undefined;
    }

    const onWheel = (event) => {
      // Let long notes and image lists scroll instead of zooming.
      const notes = event.target.closest?.(".goal-notes-text, .goal-notes-images");
      if (notes && notes.scrollHeight > notes.clientHeight && !event.ctrlKey) {
        return;
      }
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
                <div className="goal-card-row">
                <div
                  className={`goal-notes${collapsedNotes.has(matrix.id) ? " is-collapsed" : ""}`}
                  onDragOver={(event) => {
                    if (interactive && [...event.dataTransfer.types].includes("Files")) {
                      event.preventDefault();
                    }
                  }}
                  onDrop={(event) => {
                    const files = imageFiles(event.dataTransfer.files);
                    if (interactive && files.length) {
                      event.preventDefault();
                      addImages(matrix.id, files);
                    }
                  }}
                >
                  <button
                    type="button"
                    className="goal-notes-toggle"
                    tabIndex={interactive ? 0 : -1}
                    aria-expanded={!collapsedNotes.has(matrix.id)}
                    aria-label={collapsedNotes.has(matrix.id) ? "Show notes" : "Hide notes"}
                    onClick={(event) => {
                      if (interactive) {
                        event.stopPropagation();
                        toggleNotes(matrix.id);
                      }
                    }}
                  >
                    {collapsedNotes.has(matrix.id) ? "›" : "‹"}
                  </button>
                  {collapsedNotes.has(matrix.id) ? (
                    matrix.notes || matrix.images.length ? (
                      <span className="goal-notes-dot" aria-hidden="true" title="has notes" />
                    ) : null
                  ) : (
                  <>
                  <textarea
                    className="goal-notes-text"
                    aria-label="Notes"
                    value={matrix.notes}
                    placeholder="notes: why this matters, ideas, progress... paste images too"
                    maxLength={MAX_NOTES}
                    tabIndex={interactive ? 0 : -1}
                    spellCheck={false}
                    onFocus={() => {
                      if (viewRef.current.level === 2) {
                        openMatrix(matrix.id);
                      }
                    }}
                    onPaste={(event) => {
                      const files = imageFiles(event.clipboardData?.items);
                      if (files.length) {
                        event.preventDefault();
                        addImages(matrix.id, files);
                      }
                    }}
                    onChange={(event) => {
                      const notes = event.target.value;
                      editMatrix(matrix.id, (m) => ({ ...m, notes }));
                    }}
                  />
                  {matrix.images.length ? (
                    <div className="goal-notes-images">
                      {matrix.images.map((image) => {
                        const src = pendingImages[image.id] || sessionImages[image.id] || imagePath(image);
                        return (
                          <figure className="goal-note-image" key={image.id}>
                            <button
                              type="button"
                              className="goal-note-image-open"
                              tabIndex={interactive ? 0 : -1}
                              aria-label="Open image"
                              onClick={(event) => {
                                if (interactive) {
                                  event.stopPropagation();
                                  setLightbox(src);
                                }
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={src}
                                alt=""
                                loading="lazy"
                                draggable={false}
                                onError={(event) => {
                                  event.currentTarget.closest("figure")?.setAttribute("data-missing", "");
                                }}
                              />
                            </button>
                            <button
                              type="button"
                              className="goal-note-image-remove"
                              tabIndex={interactive ? 0 : -1}
                              aria-label="Remove image"
                              onClick={(event) => {
                                if (interactive) {
                                  event.stopPropagation();
                                  editMatrix(matrix.id, (m) => ({
                                    ...m,
                                    images: m.images.filter((item) => item.id !== image.id),
                                  }));
                                }
                              }}
                            >
                              ×
                            </button>
                          </figure>
                        );
                      })}
                    </div>
                  ) : null}
                  </>
                  )}
                </div>
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
                </div>
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

      {lightbox ? (
        <button type="button" className="goal-lightbox" onClick={() => setLightbox(null)} aria-label="Close image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" />
        </button>
      ) : null}
    </section>
  );
}
