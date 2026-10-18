"use client";

import { useEffect, useRef, useState } from "react";
import { makeId } from "@/lib/goal-matrix";

const WEEKDAYS = ["s", "m", "t", "w", "t", "f", "s"];
const NEW_COLORS = ["#b9d6ff", "#ffd6a5", "#d6c2ff", "#ffe0f0", "#d2ecff", "#c4f0d2", "#ffc1d5", "#fff3a8"];
const ERASER = "eraser";

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayKey() {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

export default function GoalCalendar({ calendar, onChange }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [brush, setBrush] = useState(() => calendar.legend[0]?.id || ERASER);
  // While the pointer is down, dragging across days keeps painting the same way.
  const paintRef = useRef(null);
  const today = todayKey();

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

  const shiftMonth = (delta) => {
    setMonth(({ year, month: m }) => {
      const next = new Date(year, m + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const firstWeekday = new Date(month.year, month.month, 1).getDay();
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const monthLabel = new Date(month.year, month.month, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const counts = {};
  const prefix = dateKey(month.year, month.month, 1).slice(0, 8);
  for (const [key, id] of Object.entries(calendar.days)) {
    if (key.startsWith(prefix)) {
      counts[id] = (counts[id] || 0) + 1;
    }
  }

  return (
    <aside className="goal-cal" aria-label="Calendar">
      <div className="goal-cal-head">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month">
          ‹
        </button>
        <button
          type="button"
          className="goal-cal-month"
          onClick={() => {
            const now = new Date();
            setMonth({ year: now.getFullYear(), month: now.getMonth() });
          }}
          title="Back to this month"
        >
          {monthLabel.toLowerCase()}
        </button>
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="goal-cal-grid" role="grid" aria-label={monthLabel}>
        {WEEKDAYS.map((day, index) => (
          <span className="goal-cal-weekday" key={`${day}-${index}`} aria-hidden="true">
            {day}
          </span>
        ))}
        {Array.from({ length: firstWeekday }, (_, index) => (
          <span key={`pad-${index}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const key = dateKey(month.year, month.month, day);
          const item = legendById.get(calendar.days[key]);
          return (
            <button
              type="button"
              key={key}
              className={`goal-cal-day${key === today ? " is-today" : ""}`}
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
              {day}
            </button>
          );
        })}
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
            <span className="goal-legend-count" title="days this month">
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
