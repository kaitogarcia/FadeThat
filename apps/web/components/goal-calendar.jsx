"use client";

import { useEffect, useRef, useState } from "react";
import { makeId } from "@/lib/goal-matrix";

// Two continuous columns side by side; change these to move the window.
const COLUMNS = [
  { label: "oct – nov", start: new Date(2026, 9, 1), end: new Date(2026, 10, 30) },
  { label: "dec – jan", start: new Date(2026, 11, 1), end: new Date(2027, 0, 31) },
];
const RANGE_START = COLUMNS[0].start;
const RANGE_END = COLUMNS[COLUMNS.length - 1].end;
const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = ["s", "m", "t", "w", "t", "f", "s"];
const NEW_COLORS = ["#b9d6ff", "#ffd6a5", "#d6c2ff", "#ffe0f0", "#d2ecff", "#c4f0d2", "#ffc1d5", "#fff3a8"];
const ERASER = "eraser";

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Sunday-start weeks covering start..end; days outside it are null.
function buildDays(start, end) {
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  const days = [];
  while (cursor <= end) {
    for (let i = 0; i < 7; i += 1) {
      days.push(cursor >= start && cursor <= end ? new Date(cursor) : null);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return days;
}

const COLUMN_DAYS = COLUMNS.map((column) => buildDays(column.start, column.end));
const RANGE_KEYS = { start: dateKey(RANGE_START), end: dateKey(RANGE_END) };
const END_LABEL = RANGE_END.toLocaleString("en-US", { month: "short", day: "numeric" }).toLowerCase();

function Counters({ counters, onChange }) {
  const update = (id, patch) => {
    onChange((cal) => ({
      ...cal,
      counters: cal.counters.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const step = (id, delta) => {
    onChange((cal) => ({
      ...cal,
      counters: cal.counters.map((item) => (item.id === id ? { ...item, value: item.value + delta } : item)),
    }));
  };

  const remove = (id) => {
    onChange((cal) => ({ ...cal, counters: cal.counters.filter((item) => item.id !== id) }));
  };

  const add = () => {
    onChange((cal) => ({ ...cal, counters: [...cal.counters, { id: makeId(), label: "", value: 0 }] }));
  };

  return (
    <div className="goal-counters">
      {counters.map((item) => (
        <div className="goal-counter" key={item.id}>
          <input
            type="text"
            className="goal-counter-label"
            value={item.label}
            placeholder="counter"
            maxLength={60}
            onChange={(event) => update(item.id, { label: event.target.value })}
          />
          <div className="goal-counter-controls">
            <button type="button" onClick={() => step(item.id, -1)} aria-label={`Decrease ${item.label || "counter"}`}>
              −
            </button>
            <span className="goal-counter-value" aria-live="polite">
              {item.value}
            </span>
            <button type="button" onClick={() => step(item.id, 1)} aria-label={`Increase ${item.label || "counter"}`}>
              +
            </button>
          </div>
          <button
            type="button"
            className="goal-counter-remove"
            onClick={() => remove(item.id)}
            aria-label={`Remove ${item.label || "counter"}`}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="goal-counter-add" onClick={add} disabled={counters.length >= 20}>
        + counter
      </button>
    </div>
  );
}

export default function GoalCalendar({ calendar, onChange }) {
  const [brush, setBrush] = useState(() => calendar.legend[0]?.id || ERASER);
  // While the pointer is down, dragging across days keeps painting the same way.
  const paintRef = useRef(null);
  // Today is only known in the browser; computing it there avoids a hydration mismatch.
  const [today, setToday] = useState(null);

  useEffect(() => {
    setToday(new Date());
  }, []);

  useEffect(() => {
    const stop = () => {
      paintRef.current = null;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const todayKey = today ? dateKey(today) : null;
  const daysLeft = today
    ? Math.max(
        0,
        Math.round(
          (RANGE_END - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / DAY_MS
        )
      )
    : null;

  const activeBrush = brush === ERASER || calendar.legend.some((item) => item.id === brush) ? brush : ERASER;
  const legendById = new Map(calendar.legend.map((item) => [item.id, item]));

  const setDay = (key, id) => {
    onChange((cal) => {
      const days = { ...cal.days };
      if (id) {
        days[key] = id;
      } else {
        delete days[key];
      }
      return { ...cal, days };
    });
  };

  const startPaint = (key) => {
    // Clicking a day that already has this color clears it.
    const clearing = activeBrush === ERASER || calendar.days[key] === activeBrush;
    paintRef.current = { id: clearing ? null : activeBrush };
    setDay(key, paintRef.current.id);
  };

  const continuePaint = (key) => {
    if (paintRef.current) {
      setDay(key, paintRef.current.id);
    }
  };

  const updateLegend = (id, patch) => {
    onChange((cal) => ({
      ...cal,
      legend: cal.legend.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const removeLegend = (id) => {
    onChange((cal) => ({
      ...cal,
      legend: cal.legend.filter((item) => item.id !== id),
      days: Object.fromEntries(Object.entries(cal.days).filter(([, value]) => value !== id)),
    }));
  };

  const addLegend = () => {
    const item = {
      id: makeId(),
      color: NEW_COLORS[calendar.legend.length % NEW_COLORS.length],
      label: "",
    };
    onChange((cal) => ({ ...cal, legend: [...cal.legend, item] }));
    setBrush(item.id);
  };

  const counts = {};
  for (const [key, id] of Object.entries(calendar.days)) {
    if (key >= RANGE_KEYS.start && key <= RANGE_KEYS.end) {
      counts[id] = (counts[id] || 0) + 1;
    }
  }

  return (
    <aside className="goal-cal" aria-label="Calendar">
      <div className="goal-cal-countdown">
        <span className="goal-cal-countdown-number">{daysLeft ?? "–"}</span>
        <span className="goal-cal-countdown-label">days til {END_LABEL}</span>
      </div>

      <Counters counters={calendar.counters} onChange={onChange} />

      <div className="goal-cal-columns">
        {COLUMNS.map((column, columnIndex) => (
          <section className="goal-cal-column" key={column.label} aria-label={column.label}>
            <p className="goal-cal-column-title">{column.label}</p>
            <div className="goal-cal-weekdays" aria-hidden="true">
              {WEEKDAYS.map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>
            <div className="goal-cal-grid" role="grid">
              {COLUMN_DAYS[columnIndex].map((date, index) => {
                if (!date) {
                  return <span className="goal-cal-blank" key={`blank-${index}`} aria-hidden="true" />;
                }
                const key = dateKey(date);
                const item = legendById.get(calendar.days[key]);
                const isFirst = date.getDate() === 1;
                const isToday = key === todayKey;
                return (
                  <button
                    type="button"
                    key={key}
                    className={`goal-cal-day${isToday ? " is-today" : ""}${isFirst ? " is-first" : ""}`}
                    style={item ? { backgroundColor: item.color } : undefined}
                    aria-label={`${key}${item ? `: ${item.label || "colored"}` : ""}`}
                    title={item?.label || undefined}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      startPaint(key);
                    }}
                    onPointerEnter={() => continuePaint(key)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        startPaint(key);
                        paintRef.current = null;
                      }
                    }}
                  >
                    {isFirst ? (
                      <span className="goal-cal-month-label">
                        {date.toLocaleString("en-US", { month: "short" }).toLowerCase()}
                      </span>
                    ) : null}
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="goal-legend">
        <p className="goal-legend-title">legend · pick a color, then click or drag across days</p>
        {calendar.legend.map((item) => (
          <div className={`goal-legend-row${activeBrush === item.id ? " is-active" : ""}`} key={item.id}>
            <button
              type="button"
              className="goal-legend-pick"
              aria-label={`Paint with ${item.label || "this color"}`}
              aria-pressed={activeBrush === item.id}
              onClick={() => setBrush(item.id)}
            >
              <span style={{ backgroundColor: item.color }} />
            </button>
            <input
              type="color"
              className="goal-legend-color"
              value={item.color}
              aria-label="Change color"
              onChange={(event) => updateLegend(item.id, { color: event.target.value })}
            />
            <input
              type="text"
              className="goal-legend-label"
              value={item.label}
              placeholder="label"
              maxLength={60}
              onFocus={() => setBrush(item.id)}
              onChange={(event) => updateLegend(item.id, { label: event.target.value })}
            />
            <span className="goal-legend-count" title="days oct – jan">
              {counts[item.id] || 0}
            </span>
            <button
              type="button"
              className="goal-legend-remove"
              aria-label={`Remove ${item.label || "color"}`}
              onClick={() => removeLegend(item.id)}
            >
              ×
            </button>
          </div>
        ))}

        <div className="goal-legend-tools">
          <button type="button" onClick={addLegend} disabled={calendar.legend.length >= 20}>
            + color
          </button>
          <button
            type="button"
            className={activeBrush === ERASER ? "is-active" : undefined}
            aria-pressed={activeBrush === ERASER}
            onClick={() => setBrush(ERASER)}
          >
            eraser
          </button>
        </div>
      </div>
    </aside>
  );
}
