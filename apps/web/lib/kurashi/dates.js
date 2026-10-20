// Dates are local calendar days as YYYY-MM-DD strings; weeks run Monday to Sunday.

const pad = (n) => String(n).padStart(2, "0");

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const todayISO = () => toISO(new Date());

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function addDays(s, n) {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(a, b) {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86_400_000);
}

export function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** The period of a term that contains `anchor`. */
export function rangeFor(term, anchor) {
  const d = fromISO(anchor);
  if (term === "day") return { start: anchor, end: anchor };
  if (term === "week") {
    const start = addDays(anchor, -((d.getDay() + 6) % 7));
    return { start, end: addDays(start, 6) };
  }
  if (term === "month") {
    return {
      start: toISO(new Date(d.getFullYear(), d.getMonth(), 1)),
      end: toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    };
  }
  return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31` };
}

/** The same-length period right after this list's. */
export function nextRange(list) {
  if (list.term === "custom") {
    const start = addDays(list.end, 1);
    return { start, end: addDays(start, daysBetween(list.start, list.end)) };
  }
  return rangeFor(list.term, addDays(list.end, 1));
}

export function phaseOf(list, today = todayISO()) {
  if (list.end < today) return "past";
  if (list.start > today) return "upcoming";
  return "current";
}

const locale = (lang) => (lang === "ja" ? "ja-JP" : "en-US");

function fmt(s, lang, opts) {
  return new Intl.DateTimeFormat(locale(lang), opts).format(fromISO(s));
}

export function formatDay(s, lang, withYear = false) {
  return fmt(s, lang, { month: "short", day: "numeric", weekday: "short", ...(withYear ? { year: "numeric" } : {}) });
}

export function formatMonth(ym, lang) {
  return fmt(`${ym}-01`, lang, { year: "numeric", month: "long" });
}

export function formatRange(list, lang) {
  const { term, start, end } = list;
  if (term === "day") return formatDay(start, lang);
  if (term === "month") return formatMonth(start.slice(0, 7), lang);
  if (term === "year") return lang === "ja" ? `${start.slice(0, 4)}年` : start.slice(0, 4);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const short = { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) };
  return `${fmt(start, lang, short)} – ${fmt(end, lang, short)}`;
}

/** A blank title means "name it after its period", in whatever language the page is in. */
export function listTitle(list, lang) {
  if (list.title) return list.title;
  const { term, start, end } = list;
  const ja = lang === "ja";
  if (term === "day") return ja ? `${fmt(start, lang, { month: "long", day: "numeric" })}のToDo` : `To-do · ${fmt(start, lang, { month: "short", day: "numeric" })}`;
  if (term === "week") return ja ? `${fmt(start, lang, { month: "numeric", day: "numeric" })}からの週` : `Week of ${fmt(start, lang, { month: "short", day: "numeric" })}`;
  if (term === "month") return ja ? `${fmt(start, lang, { month: "long" })}のToDo` : `${fmt(start, lang, { month: "long" })} to-do`;
  if (term === "year") return ja ? `${start.slice(0, 4)}年のToDo` : `${start.slice(0, 4)} goals`;
  const days = daysBetween(start, end) + 1;
  return ja ? `ToDo（${days}日間）` : `${days}-day to-do`;
}
