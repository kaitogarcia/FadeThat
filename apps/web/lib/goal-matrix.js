export const MAX_MATRICES = 100;
export const MAX_TEXT = 400;
export const MAX_NOTES = 4000;
export const MAX_IMAGES = 30;
export const IMAGE_ID_PATTERN = /^[a-z0-9-]{8,64}$/;
export const IMAGE_EXTS = ["webp", "jpg", "png"];

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
    subs: Array.from({ length: 8 }, () => ({ goal: "", actions: Array(8).fill("") })),
  };
}

export function normalizeMatrix(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const subs = Array.from({ length: 8 }, (_, k) => {
    const sub = Array.isArray(raw.subs) ? raw.subs[k] : null;
    const actions = Array.isArray(sub?.actions) ? sub.actions : [];
    return {
      goal: text(sub?.goal),
      actions: Array.from({ length: 8 }, (_, a) => text(actions[a])),
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
      };
    });

  return { legend, days, counters };
}

export function normalizeMatrices(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .map(normalizeMatrix)
    .filter((m) => m && !seen.has(m.id) && seen.add(m.id))
    .slice(0, MAX_MATRICES);
}
