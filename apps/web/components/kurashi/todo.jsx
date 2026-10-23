"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TERMS, makeId } from "@/lib/kurashi/data";
import { daysBetween, formatRange, listTitle, nextRange, phaseOf, rangeFor, todayISO } from "@/lib/kurashi/dates";
import { ConfirmButton, Segmented } from "@/components/kurashi/controls";
import s from "@/components/kurashi/kurashi.module.css";

const FILTERS = ["all", ...TERMS];
const PAST_PREVIEW = 6;

function timeLabel(list, t) {
  const today = todayISO();
  const phase = phaseOf(list, today);
  if (phase === "past") return t("list.ended");
  if (phase === "upcoming") return t("list.startsIn", { n: daysBetween(today, list.start) });
  const left = daysBetween(today, list.end);
  return left === 0 ? t("list.lastDay") : t("list.daysLeft", { n: left + 1 });
}

export default function TodoView({ t, lang, lists, putList, removeList }) {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  // null | { mode: "new" } | { mode: "edit", list }
  const [form, setForm] = useState(null);
  const [allPast, setAllPast] = useState(false);
  // On a phone the sidebar and the pane take turns; this says which one is showing.
  // It only drives the narrow layout's CSS; on a wide screen both are always visible.
  const [detailOpen, setDetailOpen] = useState(false);
  const openDetail = () => {
    setDetailOpen(true);
    window.scrollTo({ top: 0 });
  };
  const closeDetail = () => setDetailOpen(false);

  const today = todayISO();
  const visible = lists.filter((l) => filter === "all" || l.term === filter);
  const sections = [
    { phase: "current", items: visible.filter((l) => phaseOf(l, today) === "current").sort((a, b) => a.end.localeCompare(b.end) || a.createdAt - b.createdAt) },
    { phase: "upcoming", items: visible.filter((l) => phaseOf(l, today) === "upcoming").sort((a, b) => a.start.localeCompare(b.start)) },
    { phase: "past", items: visible.filter((l) => phaseOf(l, today) === "past").sort((a, b) => b.end.localeCompare(a.end)) },
  ];

  // Keep a list selected whenever there is one to show.
  const selected = lists.find((l) => l.id === selectedId) ?? sections.flatMap((x) => x.items)[0] ?? null;

  return (
    <div className={`${s.todo} ${detailOpen ? s.todoDetail : ""}`}>
      <aside className={`${s.card} ${s.sidebar}`}>
        <button type="button" className={`${s.btn} ${s.btnPrimary} ${s.btnWide}`} onClick={() => { setForm({ mode: "new" }); openDetail(); }}>
          ＋ {t("todo.new")}
        </button>
        <div className={s.filters}>
          {FILTERS.map((f) => (
            <button key={f} type="button" className={`${s.chip} ${filter === f ? s.chipOn : ""}`} onClick={() => setFilter(f)}>
              {t(`term.${f}`)}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <div className={s.sideEmpty}>
            <strong>{t("todo.empty")}</strong>
            <span>{t("todo.emptyHint")}</span>
          </div>
        ) : (
          sections.map(({ phase, items }) => {
            if (!items.length) return null;
            const shown = phase === "past" && !allPast ? items.slice(0, PAST_PREVIEW) : items;
            return (
              <section key={phase} className={s.sideSection}>
                <h3>{t(`phase.${phase}`)}</h3>
                {shown.map((list) => {
                  const done = list.items.filter((i) => i.done).length;
                  return (
                    <button key={list.id} type="button"
                      className={`${s.listRow} ${selected?.id === list.id && !form ? s.listRowOn : ""}`}
                      onClick={() => { setSelectedId(list.id); setForm(null); openDetail(); }}>
                      <Ring term={list.term} done={done} total={list.items.length} />
                      <span className={s.listRowMain}>
                        <span className={s.listRowTitle}>{listTitle(list, lang)}</span>
                        <span className={s.listRowSub}>{formatRange(list, lang)} · {timeLabel(list, t)}</span>
                      </span>
                      {list.items.length > 0 && <span className={s.listRowCount}>{done}/{list.items.length}</span>}
                    </button>
                  );
                })}
                {shown.length < items.length && (
                  <button type="button" className={s.linkBtn} onClick={() => setAllPast(true)}>{t("todo.showAll", { n: items.length })}</button>
                )}
              </section>
            );
          })
        )}
      </aside>

      <main className={`${s.card} ${s.pane}`}>
        <button type="button" className={s.backBtn} onClick={() => { setForm(null); closeDetail(); }}>‹ {t("todo.lists")}</button>
        {form ? (
          <ListForm key={form.mode === "edit" ? form.list.id : "new"} t={t} lang={lang} list={form.mode === "edit" ? form.list : null}
            initialTerm={filter === "all" ? "day" : filter}
            onCancel={() => { setForm(null); closeDetail(); }}
            onSubmit={(list) => { putList(list); setSelectedId(list.id); setForm(null); }} />
        ) : selected ? (
          <ListPane key={selected.id} t={t} lang={lang} list={selected} putList={putList}
            onEdit={() => setForm({ mode: "edit", list: selected })}
            onOpen={setSelectedId}
            onDelete={() => { removeList(selected.id); setSelectedId(null); closeDetail(); }} />
        ) : (
          <div className={s.paneEmpty}>
            <span className={s.emptyIcon}>✓</span>
            <strong>{t("todo.empty")}</strong>
            <span>{t("todo.pick")}</span>
          </div>
        )}
      </main>
    </div>
  );
}

function Ring({ term, done, total }) {
  const r = 11;
  const c = 2 * Math.PI * r;
  const complete = total > 0 && done === total;
  return (
    <span className={`${s.ring} ${s[`term_${term}`]} ${complete ? s.ringDone : ""}`} aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r={r} className={s.ringTrack} />
        <circle cx="14" cy="14" r={r} className={s.ringFill} strokeDasharray={c}
          strokeDashoffset={total ? c * (1 - done / total) : c} transform="rotate(-90 14 14)" />
      </svg>
      {complete && <span className={s.ringCheck}>✓</span>}
    </span>
  );
}

function ListForm({ t, lang, list, initialTerm, onSubmit, onCancel }) {
  const today = todayISO();
  const [title, setTitle] = useState(list?.title ?? "");
  const [term, setTerm] = useState(list?.term ?? initialTerm);
  const [anchor, setAnchor] = useState(list?.start ?? today);
  const [customEnd, setCustomEnd] = useState(list?.end ?? rangeFor("week", today).end);
  const [itemsText, setItemsText] = useState("");

  const range = term === "custom" ? { start: anchor, end: customEnd < anchor ? anchor : customEnd } : rangeFor(term, anchor || today);
  const year = Number(range.start.slice(0, 4));
  const placeholder = listTitle({ title: "", term, ...range }, lang);

  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      id: list?.id ?? makeId(),
      title: title.trim(),
      term,
      ...range,
      items: list ? list.items : itemsText.split("\n").map((x) => x.trim()).filter(Boolean).map((text) => ({ id: makeId(), text, done: false })),
      createdAt: list?.createdAt ?? Date.now(),
    });
  };

  return (
    <form className={s.form} onSubmit={submit}>
      <h2 className={s.paneTitle}>{list ? t("form.editTitle") : t("form.newTitle")}</h2>

      <label className={s.field}>
        <span>{t("form.name")}</span>
        <input value={title} placeholder={placeholder} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>

      <div className={s.field}>
        <span>{t("form.term")}</span>
        <Segmented value={term} onChange={setTerm} options={TERMS.map((value) => ({ value, label: t(`term.${value}`) }))} />
      </div>

      <div className={s.fieldRow}>
        {(term === "day" || term === "week") && (
          <label className={s.field}>
            <span>{term === "day" ? t("form.date") : t("form.weekOf")}</span>
            <input type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} />
          </label>
        )}
        {term === "month" && (
          <label className={s.field}>
            <span>{t("form.month")}</span>
            <input type="month" value={range.start.slice(0, 7)} onChange={(e) => e.target.value && setAnchor(`${e.target.value}-01`)} />
          </label>
        )}
        {term === "year" && (
          <div className={s.field}>
            <span>{t("form.year")}</span>
            <span className={s.stepper}>
              <button type="button" onClick={() => setAnchor(`${year - 1}-01-01`)} aria-label="-1">−</button>
              <strong>{lang === "ja" ? `${year}年` : year}</strong>
              <button type="button" onClick={() => setAnchor(`${year + 1}-01-01`)} aria-label="+1">＋</button>
            </span>
          </div>
        )}
        {term === "custom" && (
          <>
            <label className={s.field}>
              <span>{t("form.start")}</span>
              <input type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} />
            </label>
            <label className={s.field}>
              <span>{t("form.end")}</span>
              <input type="date" value={range.end} min={anchor} onChange={(e) => e.target.value && setCustomEnd(e.target.value)} />
            </label>
          </>
        )}
        <div className={s.rangePreview}>{formatRange({ term, ...range }, lang)}</div>
      </div>

      {!list && (
        <label className={s.field}>
          <span>{t("form.items")}</span>
          <textarea rows={5} value={itemsText} onChange={(e) => setItemsText(e.target.value)} />
        </label>
      )}

      <div className={s.formActions}>
        <button type="button" className={s.btn} onClick={onCancel}>{t("common.cancel")}</button>
        <button type="submit" className={`${s.btn} ${s.btnPrimary}`}>{list ? t("common.save") : t("form.create")}</button>
      </div>
    </form>
  );
}

function ListPane({ t, lang, list, putList, onEdit, onOpen, onDelete }) {
  const [hideDone, setHideDone] = useState(false);
  const done = list.items.filter((i) => i.done).length;
  const total = list.items.length;
  const shown = hideDone ? list.items.filter((i) => !i.done) : list.items;
  const setItems = (items) => putList({ ...list, items });

  const copyToNext = (onlyUnfinished) => {
    const next = {
      id: makeId(),
      // A blank title follows the period, so the copy gets named for its own dates.
      title: list.title,
      term: list.term,
      ...nextRange(list),
      items: list.items.filter((i) => !onlyUnfinished || !i.done).map((i) => ({ id: makeId(), text: i.text, done: false })),
      createdAt: Date.now(),
    };
    putList(next);
    onOpen(next.id);
  };

  return (
    <div className={s.listPane}>
      <div className={s.paneHead}>
        <div>
          <h2 className={s.paneTitle}>{listTitle(list, lang)}</h2>
          <div className={s.meta}>
            <span className={`${s.badge} ${s[`term_${list.term}`]}`}>{t(`term.${list.term}`)}</span>
            <span>{formatRange(list, lang)}</span>
            <span className={s.dot}>·</span>
            <span>{timeLabel(list, t)}</span>
          </div>
        </div>
        <div className={s.paneActions}>
          <button type="button" className={s.btn} onClick={onEdit}>{t("list.edit")}</button>
          <button type="button" className={s.btn} onClick={() => copyToNext(false)}>{t("list.copyNext")}</button>
          {done > 0 && done < total && (
            <button type="button" className={s.btn} onClick={() => copyToNext(true)}>{t("list.carryOver")}</button>
          )}
          {done > 0 && (
            <button type="button" className={s.btn} onClick={() => setHideDone((h) => !h)}>
              {hideDone ? t("list.showDone") : t("list.hideDone")}
            </button>
          )}
          <ConfirmButton label={t("list.delete")} confirmLabel={t("common.confirmDelete")} onConfirm={onDelete} />
        </div>
      </div>

      {total > 0 && (
        <div className={s.progressWrap}>
          <div className={s.progress}><span style={{ width: `${(done / total) * 100}%` }} /></div>
          <span>{t("list.progress", { done, total })}</span>
        </div>
      )}

      <ul className={s.items}>
        {shown.map((item) => (
          <ItemRow key={item.id} item={item} t={t}
            onToggle={() => setItems(list.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
            onText={(text) => setItems(text ? list.items.map((i) => (i.id === item.id ? { ...i, text } : i)) : list.items.filter((i) => i.id !== item.id))}
            onDelete={() => setItems(list.items.filter((i) => i.id !== item.id))} />
        ))}
        <NewItem placeholder={t("list.newItem")} autoFocus={total === 0}
          onAdd={(text) => setItems([...list.items, { id: makeId(), text, done: false }])} />
      </ul>
      {total === 0 && <p className={s.hint}>{t("list.empty")}</p>}
    </div>
  );
}

function grow(el) {
  if (!el) return;
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
}

function ItemRow({ item, t, onToggle, onText, onDelete }) {
  const [draft, setDraft] = useState(item.text);
  const ref = useRef(null);
  useEffect(() => setDraft(item.text), [item.text]);
  useLayoutEffect(() => grow(ref.current), [draft]);
  const commit = () => {
    const text = draft.trim();
    if (text !== item.text) onText(text);
  };
  return (
    <li className={`${s.item} ${item.done ? s.itemDone : ""}`}>
      <button type="button" className={`${s.check} ${item.done ? s.checkOn : ""}`} onClick={onToggle} aria-pressed={item.done} aria-label={item.text}>
        {item.done && "✓"}
      </button>
      <textarea ref={ref} rows={1} className={s.itemText} value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // isComposing: the Enter that confirms a Japanese IME conversion must not commit.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }} />
      <button type="button" className={s.itemDelete} onClick={onDelete} aria-label={t("common.delete")}>×</button>
    </li>
  );
}

function NewItem({ placeholder, onAdd, autoFocus }) {
  const [text, setText] = useState("");
  const add = () => {
    const value = text.trim();
    if (value) onAdd(value);
    setText("");
  };
  return (
    <li className={`${s.item} ${s.newItem}`}>
      <span className={`${s.check} ${s.checkAdd}`}>＋</span>
      <input className={s.itemText} value={text} placeholder={placeholder} autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            add();
          }
        }} />
    </li>
  );
}
