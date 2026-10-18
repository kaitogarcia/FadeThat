"use client";

import { useEffect, useRef, useState } from "react";
import { makeId } from "@/lib/goal-matrix";

// One continuous run of weeks; change these to move the window.
const RANGE_START = new Date(2026, 9, 1); // Oct 1, 2026
const RANGE_END = new Date(2027, 0, 31); // Jan 31, 2027

const WEEKDAYS = ["s", "m", "t", "w", "t", "f", "s"];
const NEW_COLORS = ["#b9d6ff", "#ffd6a5", "#d6c2ff", "#ffe0f0", "#d2ecff", "#c4f0d2", "#ffc1d5", "#fff3a8"];
const ERASER = "eraser";

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Sunday-start weeks covering the range; days outside it are null.
function buildWeeks() {
  const cursor = new Date(RANGE_START);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  const weeks = [];
  while (cursor <= RANGE_END) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(cursor >= RANGE_START && cursor <= RANGE_END ? new Date(cursor) : null);
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

const WEEKS = buildWeeks();
const RANGE_PREFIXES = { start: dateKey(RANGE_START), end: dateKey(RANGE_END) };

export default function GoalCalendar({ calendar, onChange }) {
  const [brush, setBrush] = useState(() => calendar.legend[0]?.id || ERASER);
  // While the pointer is down, dragging across days keeps painting the same way.
  const paintRef = useRef(null);
  const scrollRef = useRef(null);
  const todayRef = useRef(null);
  const [today, setToday] = useState(null);

  // Today is only known in the browser; computing it there avoids a hydration mismatch.
  useEffect(() => {
    setToday(dateKey(new Date()));
  }, []);

  // Start scrolled to the current week.
  useEffect(() => {
    const box = scrollRef.current;
    const cell = todayRef.current;
    if (box && cell) {
      box.scrollTop = Math.max(0, cell.offsetTop - box.clientHeight / 3);
    }
  }, [today]);

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

  const jumpToToday = () => {
    const box = scrollRef.current;
    const cell = todayRef.current;
    if (box && cell) {
      box.scrollTo({ top: Math.max(0, cell.offsetTop - box.clientHeight / 3), behavior: "smooth" });
    }
  };

  const counts = {};
  for (const [key, id] of Object.entries(calendar.days)) {
    if (key >= RANGE_PREFIXES.start && key <= RANGE_PREFIXES.end) {
      counts[id] = (counts[id] || 0) + 1;
    }
  }

  return (
    <aside className="goal-cal" aria-label="Calendar">
      <div className="goal-cal-head">
        <p className="goal-cal-range">oct – jan</p>
        <button type="button" onClick={jumpToToday} disabled={!today}>
          today
        </button>
      </div>

      <div className="goal-cal-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>

      <div className="goal-cal-scroll" ref={scrollRef}>
        <div className="goal-cal-grid" role="grid" aria-label="October to January">
          {WEEKS.flat().map((date, index) => {
            if (!date) {
              return <span className="goal-cal-blank" key={`blank-${index}`} aria-hidden="true" />;
            }
            const key = dateKey(date);
            const item = legendById.get(calendar.days[key]);
            const isFirst = date.getDate() === 1;
            const monthLabel = date.toLocaleString("en-US", { month: "short" }).toLowerCase();
            const isToday = key === today;
            return (
              <button
                type="button"
                key={key}
                ref={isToday ? todayRef : undefined}
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
                {isFirst ? <span className="goal-cal-month-label">{monthLabel}</span> : null}
                {date.getDate()}
              </button>
            );
          })}
        </div>
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
