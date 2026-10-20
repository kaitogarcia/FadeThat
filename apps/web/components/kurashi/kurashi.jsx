"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CURRENCIES, normalizeDoc } from "@/lib/kurashi/data";
import { translator } from "@/lib/kurashi/i18n";
import { currencyShort } from "@/lib/kurashi/money";
import { Segmented } from "@/components/kurashi/controls";
import TodoView from "@/components/kurashi/todo";
import BudgetView from "@/components/kurashi/budget";
import s from "@/components/kurashi/kurashi.module.css";

// Unsaved edits live in the browser until Save commits them to the repo.
const DRAFT_KEY = "fadethat-kurashi-draft";
// What the last Save sent. The redeploy takes about a minute, and a reload in that window
// would otherwise show the older data the page was built from.
const SAVED_KEY = "fadethat-kurashi-saved";
const TAB_KEY = "fadethat-kurashi-tab";

function read(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: Save still works.
  }
}

export default function Kurashi({ initialData }) {
  const initialSavedAt = Number(initialData?.savedAt) || 0;
  const [doc, setDoc] = useState(() => normalizeDoc(initialData));
  const [tab, setTab] = useState("todo");
  // clean | dirty | saving | saved | error
  const [saveState, setSaveState] = useState("clean");
  const [saveMessage, setSaveMessage] = useState("");
  const savedRef = useRef({ savedAt: initialSavedAt, json: JSON.stringify(normalizeDoc(initialData)) });
  const docRef = useRef(doc);
  docRef.current = doc;
  const [restored, setRestored] = useState(false);

  const lang = doc.settings.lang;
  const t = useMemo(() => translator(lang), [lang]);

  // Prefer a save that has not been deployed yet, then any unsaved edits made on top of it.
  useEffect(() => {
    const saved = read(SAVED_KEY);
    if (saved && saved.savedAt > initialSavedAt) {
      const recent = normalizeDoc(saved.doc);
      savedRef.current = { savedAt: saved.savedAt, json: JSON.stringify(recent) };
      setDoc(recent);
    } else {
      write(SAVED_KEY, null);
    }
    const draft = read(DRAFT_KEY);
    if (draft && draft.baseSavedAt >= savedRef.current.savedAt) {
      setDoc(normalizeDoc(draft.doc));
    } else if (draft) {
      write(DRAFT_KEY, null);
    }
    const storedTab = read(TAB_KEY);
    if (storedTab === "todo" || storedTab === "budget") setTab(storedTab);
    setRestored(true);
  }, [initialSavedAt]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Track unsaved changes and keep a browser draft of them.
  useEffect(() => {
    if (!restored) return;
    const dirty = JSON.stringify(doc) !== savedRef.current.json;
    write(DRAFT_KEY, dirty ? { baseSavedAt: savedRef.current.savedAt, doc } : null);
    setSaveState((state) => (state === "saving" ? state : dirty ? "dirty" : state === "dirty" ? "clean" : state));
  }, [doc, restored]);

  const save = useCallback(async () => {
    if (saveState === "saving") return;
    const sent = docRef.current;
    const json = JSON.stringify(sent);
    setSaveState("saving");
    setSaveMessage("");
    try {
      const response = await fetch("/api/kurashi/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: json,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Save failed (${response.status}).`);
      savedRef.current = { savedAt: payload.savedAt, json };
      write(SAVED_KEY, { savedAt: payload.savedAt, doc: sent });
      const stillDirty = JSON.stringify(docRef.current) !== json;
      write(DRAFT_KEY, stillDirty ? { baseSavedAt: payload.savedAt, doc: docRef.current } : null);
      setSaveState(stillDirty ? "dirty" : "saved");
      setSaveMessage(payload.mode === "github" ? "save.github" : "save.file");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error.message || "Save failed.");
    }
  }, [saveState]);

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

  const api = useMemo(() => ({
    putList: (list) => setDoc((d) => ({ ...d, lists: [...d.lists.filter((l) => l.id !== list.id), list] })),
    removeList: (id) => setDoc((d) => ({ ...d, lists: d.lists.filter((l) => l.id !== id) })),
    putExpenses: (items) => setDoc((d) => {
      const ids = new Set(items.map((e) => e.id));
      return { ...d, expenses: [...d.expenses.filter((e) => !ids.has(e.id)), ...items] };
    }),
    removeExpense: (id) => setDoc((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) })),
  }), []);

  const status =
    saveState === "saving" ? t("save.saving")
      : saveState === "dirty" ? t("save.dirty")
        : saveState === "error" ? saveMessage
          : saveState === "saved" ? t(saveMessage)
            : t("save.clean");

  const switchTab = (next) => {
    setTab(next);
    write(TAB_KEY, next);
  };

  return (
    <div className={s.app}>
      <header className={s.top}>
        <div className={s.brand}>
          <span className={s.logo} aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h1>{t("app.name")}</h1>
        </div>

        <Segmented label="view" value={tab} onChange={switchTab}
          options={[{ value: "todo", label: t("tab.todo") }, { value: "budget", label: t("tab.budget") }]} />

        <div className={s.topRight}>
          <Segmented size="sm" label={t("settings.language")} value={lang}
            onChange={(v) => setDoc((d) => ({ ...d, settings: { ...d.settings, lang: v } }))}
            options={[{ value: "ja", label: "日本語" }, { value: "en", label: "EN" }]} />
          <label className={s.selectPill} title={t("settings.currency")}>
            <span className={s.srOnly}>{t("settings.currency")}</span>
            <select value={doc.settings.currency}
              onChange={(e) => setDoc((d) => ({ ...d, settings: { ...d.settings, currency: e.target.value } }))}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{currencyShort(c, lang)}</option>)}
            </select>
          </label>
          <span className={`${s.status} ${saveState === "error" ? s.statusError : ""} ${saveState === "dirty" ? s.statusDirty : ""}`}
            role="status" title={t("save.hint")}>
            {status}
          </span>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={save}
            disabled={saveState === "saving" || saveState === "clean" || saveState === "saved"}>
            {saveState === "saving" ? t("save.saving") : t("save.save")}
          </button>
        </div>
      </header>

      {tab === "todo" ? (
        <TodoView t={t} lang={lang} lists={doc.lists} putList={api.putList} removeList={api.removeList} />
      ) : (
        <BudgetView t={t} lang={lang} expenses={doc.expenses} defaultCurrency={doc.settings.currency}
          putExpenses={api.putExpenses} removeExpense={api.removeExpense} />
      )}
    </div>
  );
}
