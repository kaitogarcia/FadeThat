"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, CURRENCIES, categoryInfo, makeId } from "@/lib/kurashi/data";
import { addMonths, daysBetween, formatDay, formatMonth, todayISO } from "@/lib/kurashi/dates";
import { currencyShort, formatMoney, fractionDigits, roundFor, sum } from "@/lib/kurashi/money";
import { ConfirmButton, Segmented } from "@/components/kurashi/controls";
import ScanPanel from "@/components/kurashi/scan";
import s from "@/components/kurashi/kurashi.module.css";

export default function BudgetView({ t, lang, expenses, defaultCurrency, putExpenses, removeExpense }) {
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [picked, setPicked] = useState(null);
  const [category, setCategory] = useState(null);
  // null | "new" | expense
  const [editing, setEditing] = useState(null);

  const inMonth = expenses.filter((e) => e.date.startsWith(month));
  // Totals are per currency: adding yen to dollars would need exchange rates.
  const counts = new Map();
  for (const e of inMonth) counts.set(e.currency, (counts.get(e.currency) ?? 0) + 1);
  const currencies = [...counts.keys()].sort((a, b) =>
    (b === defaultCurrency) - (a === defaultCurrency) || counts.get(b) - counts.get(a));
  const currency = picked && counts.has(picked) ? picked : currencies[0] ?? defaultCurrency;

  const spent = inMonth.filter((e) => e.currency === currency);
  const total = sum(spent);
  const lastTotal = sum(expenses.filter((e) => e.date.startsWith(addMonths(month, -1)) && e.currency === currency));
  const change = lastTotal > 0 ? (total - lastTotal) / lastTotal : null;
  // Days elapsed this month, or the whole month for a past one.
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = month === thisMonth ? daysBetween(`${month}-01`, today) + 1 : daysInMonth;

  const byCategory = CATEGORIES
    .map((c) => ({ ...c, total: sum(spent.filter((e) => e.category === c.id)) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const history = (category ? spent.filter((e) => e.category === category) : inMonth)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const groups = [];
  for (const e of history) {
    const last = groups[groups.length - 1];
    if (last?.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }

  const goMonth = (next) => {
    setMonth(next);
    setCategory(null);
  };

  return (
    <div className={s.budget}>
      <div className={s.budgetBar}>
        <div className={s.monthSwitch}>
          <button type="button" className={s.iconBtn} onClick={() => goMonth(addMonths(month, -1))} aria-label={t("budget.prevMonth")}>‹</button>
          <h2>{formatMonth(month, lang)}</h2>
          <button type="button" className={s.iconBtn} disabled={month >= thisMonth} onClick={() => goMonth(addMonths(month, 1))} aria-label={t("budget.nextMonth")}>›</button>
          {month !== thisMonth && <button type="button" className={s.linkBtn} onClick={() => goMonth(thisMonth)}>{t("budget.thisMonth")}</button>}
        </div>
        <div className={s.budgetBarRight}>
          {currencies.length > 1 && (
            <Segmented size="sm" label={t("expense.currency")} value={currency} onChange={(c) => { setPicked(c); setCategory(null); }}
              options={currencies.map((c) => ({ value: c, label: currencyShort(c, lang) }))} />
          )}
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => setEditing("new")}>＋ {t("budget.add")}</button>
        </div>
      </div>

      <div className={s.kpis}>
        <div className={`${s.card} ${s.kpi} ${s.kpiMain}`}>
          <span>{t("budget.total")}</span>
          <strong>{formatMoney(total, currency, lang)}</strong>
        </div>
        <div className={`${s.card} ${s.kpi}`}>
          <span>{t("budget.count")}</span>
          <strong>{spent.length}</strong>
        </div>
        <div className={`${s.card} ${s.kpi}`}>
          <span>{t("budget.perDay")}</span>
          <strong>{formatMoney(roundFor(total / days, currency), currency, lang)}</strong>
        </div>
        <div className={`${s.card} ${s.kpi}`}>
          <span>{t("budget.vsLast")}</span>
          {change === null ? (
            <em className={s.kpiMuted}>{t("budget.noCompare")}</em>
          ) : (
            <strong className={change > 0 ? s.up : s.down}>{change > 0 ? "+" : ""}{Math.round(change * 100)}%</strong>
          )}
        </div>
      </div>

      <ScanPanel t={t} lang={lang} expenses={expenses}
        onAdd={(items) => {
          putExpenses(items);
          goMonth(items[0].date.slice(0, 7));
        }} />

      <div className={s.budgetGrid}>
        <section className={`${s.card} ${s.catCard}`}>
          <h3 className={s.cardTitle}>{t("budget.byCategory")}</h3>
          {byCategory.length === 0 ? (
            <p className={s.hint}>{t("budget.empty")}</p>
          ) : (
            <>
              <div className={s.donutWrap}>
                <Donut slices={byCategory.map((c) => ({ id: c.id, value: c.total, color: c.color }))} active={category} />
                <div className={s.donutCenter}>
                  <span>{category ? t(`cat.${category}`) : t("budget.total")}</span>
                  <strong>{formatMoney(category ? byCategory.find((c) => c.id === category)?.total ?? 0 : total, currency, lang)}</strong>
                </div>
              </div>
              <ul className={s.catList}>
                {byCategory.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={`${s.catRow} ${category === c.id ? s.catRowOn : ""}`}
                      onClick={() => setCategory(category === c.id ? null : c.id)}>
                      <span className={s.tile} style={{ background: c.color }}>{c.emoji}</span>
                      <span className={s.catMain}>
                        <span className={s.catName}>{t(`cat.${c.id}`)}<span>{Math.round((c.total / total) * 100)}%</span></span>
                        <span className={s.bar}><span style={{ width: `${(c.total / byCategory[0].total) * 100}%`, background: c.color }} /></span>
                      </span>
                      <span className={s.amount}>{formatMoney(c.total, currency, lang)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={`${s.card} ${s.historyCard}`}>
          <div className={s.cardTitleRow}>
            <h3 className={s.cardTitle}>{t("budget.history")}</h3>
            {category && (
              <button type="button" className={`${s.chip} ${s.chipOn}`} onClick={() => setCategory(null)}>
                {categoryInfo(category).emoji} {t("budget.filter", { c: t(`cat.${category}`) })} ✕
              </button>
            )}
          </div>
          {groups.length === 0 ? (
            <p className={s.hint}>{t("budget.empty")}</p>
          ) : (
            <table className={s.table}>
              <tbody>
                {groups.map((g) => (
                  <DayGroup key={g.date} group={g} t={t} lang={lang} onEdit={setEditing} onDelete={removeExpense} />
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {editing && (
        <ExpenseDialog t={t} lang={lang} expense={editing === "new" ? null : editing}
          defaultDate={month === thisMonth ? today : `${month}-01`} defaultCurrency={defaultCurrency}
          onClose={() => setEditing(null)}
          onSave={(e) => { putExpenses([e]); setEditing(null); }}
          onDelete={(id) => { removeExpense(id); setEditing(null); }} />
      )}
    </div>
  );
}

function DayGroup({ group, t, lang, onEdit, onDelete }) {
  const totals = new Map();
  for (const e of group.items) totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.amount);
  return (
    <>
      <tr className={s.dayRow}>
        <th colSpan={2}>{formatDay(group.date, lang)}</th>
        <th colSpan={2} className={s.right}>{[...totals].map(([c, n]) => formatMoney(n, c, lang)).join(" · ")}</th>
      </tr>
      {group.items.map((e) => {
        const info = categoryInfo(e.category);
        return (
          <tr key={e.id} className={s.txRow} onClick={() => onEdit(e)}>
            <td className={s.txIcon}><span className={s.tile} style={{ background: info.color }}>{info.emoji}</span></td>
            <td>
              <span className={s.txTitle}>{e.merchant || t(`cat.${e.category}`)}</span>
              <span className={s.txSub}>{[t(`cat.${e.category}`), e.note].filter(Boolean).join(" · ")}</span>
            </td>
            <td className={`${s.right} ${s.amount}`}>{formatMoney(e.amount, e.currency, lang)}</td>
            <td className={s.txActions}>
              <button type="button" className={s.itemDelete} aria-label={t("common.delete")}
                onClick={(event) => { event.stopPropagation(); onDelete(e.id); }}>×</button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function Donut({ slices, active }) {
  const size = 200;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((n, x) => n + x.value, 0);
  const gap = slices.length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <svg className={s.donut} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className={s.donutTrack} strokeWidth={stroke} />
      {slices.map((x) => {
        const len = (x.value / total) * c;
        const el = (
          <circle key={x.id} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={x.color} strokeWidth={stroke}
            strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} opacity={active && active !== x.id ? 0.25 : 1} />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

function ExpenseDialog({ t, lang, expense, defaultDate, defaultCurrency, onClose, onSave, onDelete }) {
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [currency, setCurrency] = useState(expense?.currency ?? defaultCurrency);
  const [merchant, setMerchant] = useState(expense?.merchant ?? "");
  const [category, setCategory] = useState(expense?.category ?? "food");
  const [date, setDate] = useState(expense?.date ?? defaultDate);
  const [note, setNote] = useState(expense?.note ?? "");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const value = Number(amount.replace(/[,，\s]/g, ""));
  const valid = Number.isFinite(value) && value > 0;

  const submit = (event) => {
    event.preventDefault();
    if (!valid) return;
    onSave({
      id: expense?.id ?? makeId(),
      amount: roundFor(value, currency),
      currency,
      merchant: merchant.trim(),
      category,
      date,
      note: note.trim(),
      source: expense?.source ?? "manual",
      createdAt: expense?.createdAt ?? Date.now(),
    });
  };

  return (
    <div className={s.modalLayer}>
      <div className={s.backdrop} onClick={onClose} />
      <form className={s.modal} role="dialog" aria-modal="true" aria-label={expense ? t("expense.edit") : t("expense.new")} onSubmit={submit}>
        <h2 className={s.paneTitle}>{expense ? t("expense.edit") : t("expense.new")}</h2>

        <div className={s.amountEntry}>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label={t("expense.currency")}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{currencyShort(c, lang)}</option>)}
          </select>
          <input inputMode={fractionDigits(currency) ? "decimal" : "numeric"} placeholder="0" value={amount} autoFocus
            aria-label={t("expense.amount")} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div className={s.fieldRow}>
          <label className={`${s.field} ${s.grow}`}>
            <span>{t("expense.merchant")}</span>
            <input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
          </label>
          <label className={s.field}>
            <span>{t("expense.date")}</span>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </label>
        </div>

        <div className={s.field}>
          <span>{t("expense.category")}</span>
          <div className={s.catGrid}>
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" className={`${s.catCell} ${c.id === category ? s.catCellOn : ""}`}
                style={{ "--c": c.color }} onClick={() => setCategory(c.id)}>
                <span className={s.tile} style={{ background: c.color }}>{c.emoji}</span>
                {t(`cat.${c.id}`)}
              </button>
            ))}
          </div>
        </div>

        <label className={s.field}>
          <span>{t("expense.note")}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className={s.formActions}>
          {expense && <ConfirmButton className={s.pushLeft} label={t("common.delete")} confirmLabel={t("common.confirmDelete")} onConfirm={() => onDelete(expense.id)} />}
          <button type="button" className={s.btn} onClick={onClose}>{t("common.cancel")}</button>
          <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={!valid}>{t("common.save")}</button>
        </div>
      </form>
    </div>
  );
}
