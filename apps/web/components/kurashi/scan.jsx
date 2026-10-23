"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, CURRENCIES, categoryInfo, makeId, normalizeExpense } from "@/lib/kurashi/data";
import { todayISO } from "@/lib/kurashi/dates";
import { currencyShort, roundFor } from "@/lib/kurashi/money";
import s from "@/components/kurashi/kurashi.module.css";

const MAX_IMAGES = 6;
// Claude scales anything with a longer edge than this down anyway; more is wasted upload.
const MAX_EDGE = 1568;

async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { data: url.slice(url.indexOf(",") + 1), mediaType: "image/jpeg", preview: url };
}

/** Model output is a suggestion: clamp it to storable values and flag likely repeats. */
function review(raw, existing) {
  const today = todayISO();
  return raw.map((r) => {
    const e = normalizeExpense({ ...r, date: r.date > today ? today : r.date, source: "scan" });
    const duplicate = existing.some((x) => x.date === e.date && x.currency === e.currency && x.amount === e.amount);
    return { ...e, amount: e.amount ? String(e.amount) : "", key: makeId(), duplicate, include: !duplicate && e.amount > 0 };
  });
}

export default function ScanPanel({ t, lang, expenses, onAdd }) {
  // idle | reading | review | error
  const [phase, setPhase] = useState("idle");
  const [found, setFound] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef(null);
  const lastFiles = useRef([]);
  const expensesRef = useRef(expenses);
  expensesRef.current = expenses;

  async function read(files) {
    const images = files.filter((f) => f.type.startsWith("image/")).slice(0, MAX_IMAGES);
    if (!images.length) return;
    lastFiles.current = images;
    setPhase("reading");
    setError("");
    setNotice("");
    try {
      const shrunk = await Promise.all(images.map(shrink));
      setPreviews(shrunk.map((i) => i.preview));
      const response = await fetch("/api/kurashi/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: shrunk.map(({ data, mediaType }) => ({ data, mediaType })), today: todayISO(), lang }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
      setFound(review(body.expenses ?? [], expensesRef.current));
      setPhase("review");
    } catch (e) {
      setError(e.message || String(e));
      setPhase("error");
    }
  }

  // ⌘V anywhere on the budget view pastes a screenshot in, unless the user is typing.
  useEffect(() => {
    const onPaste = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length) {
        event.preventDefault();
        read(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const chosen = found.filter((f) => f.include && Number(f.amount) > 0);
  const patch = (key, change) => setFound((list) => list.map((f) => (f.key === key ? { ...f, ...change } : f)));

  const add = () => {
    const now = Date.now();
    const items = chosen.map((f, i) => ({
      id: makeId(),
      date: f.date,
      amount: roundFor(Number(f.amount), f.currency),
      currency: f.currency,
      category: f.category,
      merchant: f.merchant.trim(),
      note: f.note.trim(),
      source: "scan",
      createdAt: now + i,
    }));
    onAdd(items);
    setNotice(t("scan.added", { n: items.length }));
    setFound([]);
    setPreviews([]);
    setPhase("idle");
  };

  return (
    <section className={`${s.card} ${s.scan}`}>
      <input ref={input} type="file" accept="image/*" multiple hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          read(files);
        }} />

      {(phase === "idle" || phase === "error") && (
        <button type="button" className={`${s.drop} ${over ? s.dropOver : ""}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); read([...e.dataTransfer.files]); }}>
          <span className={s.dropIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9ZM12 16a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
            </svg>
          </span>
          <span className={s.dropText}>
            <strong>{t("scan.title")}</strong>
            <span>{t("scan.drop")}</span>
            <em>
              <span className={s.hintMouse}>{t("scan.dropHint")}</span>
              <span className={s.hintTouch}>{t("scan.tapHint")}</span>
            </em>
          </span>
          {notice && <span className={s.notice}>{notice}</span>}
        </button>
      )}

      {phase === "error" && (
        <div className={s.scanError}>
          <strong>{t("scan.failed")}</strong> <span>{error}</span>
          <button type="button" className={s.btn} onClick={() => read(lastFiles.current)}>{t("scan.retry")}</button>
        </div>
      )}

      {phase === "reading" && (
        <div className={s.scanBusy}>
          <Thumbs previews={previews} />
          <span className={s.spinner} aria-hidden="true" />
          <strong>{t("scan.reading")}</strong>
        </div>
      )}

      {phase === "review" && (
        <div className={s.review}>
          <div className={s.reviewHead}>
            <Thumbs previews={previews} />
            <p>{found.length ? t("scan.found", { n: found.length }) : t("scan.none")}</p>
            <div className={s.formActions}>
              <button type="button" className={s.btn} onClick={() => { setPhase("idle"); setFound([]); setPreviews([]); }}>{t("scan.discard")}</button>
              <button type="button" className={`${s.btn} ${s.btnPrimary}`} disabled={!chosen.length} onClick={add}>{t("scan.addN", { n: chosen.length })}</button>
            </div>
          </div>
          {found.length > 0 && (
            <table className={`${s.table} ${s.reviewTable}`}>
              <thead>
                <tr>
                  <th />
                  <th>{t("expense.date")}</th>
                  <th>{t("expense.merchant")}</th>
                  <th>{t("expense.category")}</th>
                  <th className={s.right}>{t("expense.amount")}</th>
                  <th>{t("expense.note")}</th>
                </tr>
              </thead>
              <tbody>
                {found.map((f) => (
                  <tr key={f.key} className={f.include ? undefined : s.off}>
                    <td>
                      <button type="button" className={`${s.check} ${f.include ? s.checkOn : ""}`} aria-pressed={f.include}
                        onClick={() => patch(f.key, { include: !f.include })}>{f.include && "✓"}</button>
                    </td>
                    <td><input type="date" value={f.date} onChange={(e) => e.target.value && patch(f.key, { date: e.target.value })} /></td>
                    <td>
                      <input value={f.merchant} placeholder={t("expense.merchant")} onChange={(e) => patch(f.key, { merchant: e.target.value })} />
                      {f.duplicate && <em className={s.dup}>{t("scan.dup")}</em>}
                    </td>
                    <td>
                      <select value={f.category} onChange={(e) => patch(f.key, { category: e.target.value })}>
                        {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{categoryInfo(c.id).emoji} {t(`cat.${c.id}`)}</option>)}
                      </select>
                    </td>
                    <td className={s.right}>
                      <span className={s.amountCell}>
                        <input inputMode="decimal" value={f.amount} onChange={(e) => patch(f.key, { amount: e.target.value })} />
                        <select value={f.currency} onChange={(e) => patch(f.key, { currency: e.target.value })}>
                          {[...new Set([f.currency, ...CURRENCIES])].map((c) => <option key={c} value={c}>{currencyShort(c, lang)}</option>)}
                        </select>
                      </span>
                    </td>
                    <td><input value={f.note} placeholder={t("expense.note")} onChange={(e) => patch(f.key, { note: e.target.value })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

function Thumbs({ previews }) {
  if (!previews.length) return null;
  return (
    <div className={s.thumbs}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URLs, nothing to optimise */}
      {previews.map((src, i) => <img key={i} src={src} alt="" />)}
    </div>
  );
}
