// The shape of apps/web/data/kurashi.json, shared by the page and the save route. The route
// runs every save through normalizeDoc, so only this shape ever reaches the repo.
import { ISO_DATE, todayISO } from "@/lib/kurashi/dates";

export const TERMS = ["day", "week", "month", "year", "custom"];

export const CURRENCIES = ["JPY", "USD", "EUR", "GBP", "CNY", "KRW", "TWD", "HKD", "SGD", "THB", "AUD", "CAD", "CHF"];

export const CATEGORIES = [
  { id: "food", color: "#ff9500", emoji: "🍙" },
  { id: "daily", color: "#30b0c7", emoji: "🧴" },
  { id: "transport", color: "#007aff", emoji: "🚃" },
  { id: "housing", color: "#a2845e", emoji: "🏠" },
  { id: "utilities", color: "#ffcc00", emoji: "💡" },
  { id: "phone", color: "#5856d6", emoji: "📱" },
  { id: "fun", color: "#ff2d55", emoji: "🎮" },
  { id: "clothing", color: "#af52de", emoji: "👕" },
  { id: "health", color: "#ff3b30", emoji: "💊" },
  { id: "education", color: "#34c759", emoji: "📚" },
  { id: "other", color: "#8e8e93", emoji: "📦" },
];

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export const categoryInfo = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

export const MAX_LISTS = 1000;
export const MAX_ITEMS = 300;
export const MAX_EXPENSES = 20000;
const MAX_TEXT = 300;
const ID_PATTERN = /^[A-Za-z0-9-]{6,64}$/;

export function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const text = (value) => (typeof value === "string" ? value.slice(0, MAX_TEXT) : "");
const id = (value) => (typeof value === "string" && ID_PATTERN.test(value) ? value : makeId());
const date = (value, fallback) => (typeof value === "string" && ISO_DATE.test(value) ? value : fallback);
const stamp = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Math.round(Number(value)) : Date.now());

export function normalizeList(raw) {
  const start = date(raw?.start, todayISO());
  const end = date(raw?.end, start);
  return {
    id: id(raw?.id),
    title: text(raw?.title),
    term: TERMS.includes(raw?.term) ? raw.term : "custom",
    start,
    end: end < start ? start : end,
    items: (Array.isArray(raw?.items) ? raw.items : [])
      .slice(0, MAX_ITEMS)
      .map((item) => ({ id: id(item?.id), text: text(item?.text), done: Boolean(item?.done) }))
      .filter((item) => item.text),
    createdAt: stamp(raw?.createdAt),
  };
}

export function normalizeExpense(raw) {
  const amount = Math.abs(Number(raw?.amount)) || 0;
  const currency = typeof raw?.currency === "string" && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : "JPY";
  return {
    id: id(raw?.id),
    date: date(raw?.date, todayISO()),
    amount: Math.round(amount * 100) / 100,
    currency,
    category: CATEGORY_IDS.includes(raw?.category) ? raw.category : "other",
    merchant: text(raw?.merchant),
    note: text(raw?.note),
    source: raw?.source === "scan" ? "scan" : "manual",
    createdAt: stamp(raw?.createdAt),
  };
}

export function normalizeDoc(raw) {
  const lang = raw?.settings?.lang === "en" ? "en" : "ja";
  const currency = CURRENCIES.includes(raw?.settings?.currency) ? raw.settings.currency : "JPY";
  return {
    settings: { lang, currency },
    lists: (Array.isArray(raw?.lists) ? raw.lists : []).slice(0, MAX_LISTS).map(normalizeList),
    expenses: (Array.isArray(raw?.expenses) ? raw.expenses : [])
      .slice(0, MAX_EXPENSES)
      .map(normalizeExpense)
      .filter((e) => e.amount > 0),
  };
}
