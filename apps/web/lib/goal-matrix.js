export const MAX_MATRICES = 100;
export const MAX_TEXT = 400;
export const MAX_NOTES = 4000;
export const MAX_IMAGES = 30;
export const IMAGE_ID_PATTERN = /^[a-z0-9-]{8,64}$/;
export const IMAGE_EXTS = ["webp", "jpg", "png"];
// Each action cell can hold its own short checklist of sub-goals.
export const MAX_SUBGOALS = 20;
export const MAX_SUBGOAL_TEXT = 200;

// Pasted note images live in the repo at public/goal-images/<id>.<ext>.
export function imagePath(image) {
  return `/goal-images/${image.id}.${image.ext}`;
}

function normalizeImages(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter(
      (image) =>
        image &&
        IMAGE_ID_PATTERN.test(image.id) &&
        IMAGE_EXTS.includes(image.ext) &&
        !seen.has(image.id) &&
        seen.add(image.id)
    )
    .slice(0, MAX_IMAGES)
    .map((image) => ({ id: image.id, ext: image.ext }));
}

export function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function text(value) {
  return typeof value === "string" ? value.slice(0, MAX_TEXT) : "";
}

export function emptyMatrix() {
  return {
    id: makeId(),
    goal: "",
    notes: "",
    images: [],
    subs: Array.from({ length: 8 }, () => ({
      goal: "",
      actions: Array(8).fill(""),
      children: Array.from({ length: 8 }, () => []),
    })),
  };
}

// Sub-goals of one action cell: [{ id, text, done }]. Missing or malformed input becomes [].
export function normalizeSubgoals(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter((item) => item && typeof item === "object")
    .slice(0, MAX_SUBGOALS)
    .map((item) => {
      let id = typeof item.id === "string" && item.id ? item.id.slice(0, 120) : "";
      if (!id || seen.has(id)) {
        id = makeId();
      }
      seen.add(id);
      return {
        id,
        text: typeof item.text === "string" ? item.text.slice(0, MAX_SUBGOAL_TEXT) : "",
        done: item.done === true,
      };
    });
}

export function normalizeMatrix(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const subs = Array.from({ length: 8 }, (_, k) => {
    const sub = Array.isArray(raw.subs) ? raw.subs[k] : null;
    const actions = Array.isArray(sub?.actions) ? sub.actions : [];
    const children = Array.isArray(sub?.children) ? sub.children : [];
    return {
      goal: text(sub?.goal),
      actions: Array.from({ length: 8 }, (_, a) => text(actions[a])),
      children: Array.from({ length: 8 }, (_, a) => normalizeSubgoals(children[a])),
    };
  });
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 120) : makeId(),
    goal: text(raw.goal),
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, MAX_NOTES) : "",
    images: normalizeImages(raw.images),
    subs,
  };
}

const MAX_LEGEND = 20;
const MAX_DAYS = 5000;
const MAX_COUNTERS = 20;
const MAX_RANGES = 50;
const MAX_COUNT = 1_000_000;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeCalendar(raw) {
  const seen = new Set();
  const legend = (Array.isArray(raw?.legend) ? raw.legend : [])
    .filter((item) => item && typeof item.id === "string" && item.id && !seen.has(item.id) && seen.add(item.id))
    .slice(0, MAX_LEGEND)
    .map((item) => ({
      id: item.id.slice(0, 120),
      color: COLOR_PATTERN.test(item.color) ? item.color.toLowerCase() : "#d9d9d9",
      label: typeof item.label === "string" ? item.label.slice(0, 60) : "",
    }));

  const ids = new Set(legend.map((item) => item.id));
  const days = {};
  const entries = raw?.days && typeof raw.days === "object" ? Object.entries(raw.days) : [];
  for (const [date, id] of entries.slice(0, MAX_DAYS)) {
    if (DATE_PATTERN.test(date) && ids.has(id)) {
      days[date] = id;
    }
  }

  const counterIds = new Set();
  const counters = (Array.isArray(raw?.counters) ? raw.counters : [])
    .filter(
      (item) => item && typeof item.id === "string" && item.id && !counterIds.has(item.id) && counterIds.add(item.id)
    )
    .slice(0, MAX_COUNTERS)
    .map((item) => {
      const value = Math.round(Number(item.value));
      return {
        id: item.id.slice(0, 120),
        label: typeof item.label === "string" ? item.label.slice(0, 60) : "",
        value: Number.isFinite(value) ? Math.max(-MAX_COUNT, Math.min(MAX_COUNT, value)) : 0,
        target: typeof item.target === "string" ? item.target.slice(0, 20) : "",
      };
    });

  // Highlighted date ranges, drawn as strips under the days (separate from day colors).
  const rangeIds = new Set();
  const ranges = (Array.isArray(raw?.ranges) ? raw.ranges : [])
    .filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        item.id &&
        DATE_PATTERN.test(item.start) &&
        DATE_PATTERN.test(item.end) &&
        !rangeIds.has(item.id) &&
        rangeIds.add(item.id)
    )
    .slice(0, MAX_RANGES)
    .map((item) => ({
      id: item.id.slice(0, 120),
      start: item.start <= item.end ? item.start : item.end,
      end: item.start <= item.end ? item.end : item.start,
      color: COLOR_PATTERN.test(item.color) ? item.color.toLowerCase() : "#7c9cff",
      label: typeof item.label === "string" ? item.label.slice(0, 60) : "",
    }));

  return { legend, days, counters, ranges };
}

export function normalizeMatrices(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map(normalizeMatrix)
    .filter((m) => m && !seen.has(m.id) && seen.add(m.id))
    .slice(0, MAX_MATRICES);
}
