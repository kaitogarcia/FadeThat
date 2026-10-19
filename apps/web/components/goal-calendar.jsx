"use client";

import { useEffect, useRef, useState } from "react";
import { makeId } from "@/lib/goal-matrix";
import collapseStyles from "@/components/goal-calendar-collapse.module.css";

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
// Saturated so highlight strips stay visible on top of pastel day colors.
const RANGE_COLORS = ["#5b7cfa", "#ff9f1c", "#2ec4b6", "#e84393", "#8e44ad", "#00a8e8"];
const MAX_STRIPS = 3;
const ERASER = "eraser";

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleString("en-US", { month: "short", day: "numeric" }).toLowerCase();
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
const COLUMN_KEYS = COLUMNS.map((column) => ({ start: dateKey(column.start), end: dateKey(column.end) }));

// Give each range a fixed lane (interval coloring) so its strip stays at the same height
// on every day it covers and reads as one continuous band.
function assignLanes(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const laneEnds = [];
  const lanes = new Map();
  for (const range of sorted) {
    let lane = laneEnds.findIndex((end) => end < range.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(range.end);
    } else {
      laneEnds[lane] = range.end;
    }
    lanes.set(range.id, lane);
  }
  return lanes;
}
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
    onChange((cal) => ({
      ...cal,
      counters: [...cal.counters, { id: makeId(), label: "", value: 0, target: "" }],
    }));
  };

  // Reads like a line of text: `label   − x + / y`; inputs size to their content.
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
            size={Math.max(7, item.label.length)}
            onChange={(event) => update(item.id, { label: event.target.value })}
          />
          <span className="goal-counter-controls">
            <button type="button" onClick={() => step(item.id, -1)} aria-label={`Decrease ${item.label || "counter"}`}>
              −
            </button>
            <span className="goal-counter-value" aria-live="polite">
              {item.value}
            </span>
            <button type="button" onClick={() => step(item.id, 1)} aria-label={`Increase ${item.label || "counter"}`}>
              +
            </button>
          </span>
          <span className="goal-counter-slash" aria-hidden="true">
            /
          </span>
          <input
            type="text"
            className="goal-counter-target"
            value={item.target}
            placeholder="y"
            maxLength={20}
            size={Math.max(1, item.target.length)}
            aria-label={`Target for ${item.label || "counter"}`}
            onChange={(event) => update(item.id, { target: event.target.value })}
          />
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

function Chevron({ direction }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={direction === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function GoalCalendar({ calendar, onChange, collapsed = false, onToggleCollapsed }) {
  const [brush, setBrush] = useState(() => calendar.legend[0]?.id || ERASER);
  // While the pointer is down, dragging across days keeps painting the same way.
  const paintRef = useRef(null);
  // Today is only known in the browser; computing it there avoids a hydration mismatch.
  const [today, setToday] = useState(null);
  // Range picking: null = off, { start: null } = waiting for start, { start: key } = waiting for end.
  const [rangePick, setRangePick] = useState(null);
  const [hoverKey, setHoverKey] = useState(null);
  // The collapse toggle is a different button open vs collapsed; keep keyboard focus on it.
  const toggleRef = useRef(null);
  const refocusToggle = useRef(false);

  useEffect(() => {
    if (refocusToggle.current) {
      refocusToggle.current = false;
      toggleRef.current?.focus();
    }
  }, [collapsed]);

  const toggleCollapsed = () => {
    refocusToggle.current = true;
    onToggleCollapsed?.();
  };

  useEffect(() => {
    setToday(new Date());
  }, []);

  // Esc cancels range picking.
  useEffect(() => {
    if (!rangePick) {
      return undefined;
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        setRangePick(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [rangePick]);

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

  const pickRangeDay = (key) => {
    if (!rangePick.start) {
      setRangePick({ start: key });
      return;
    }
    const [start, end] = rangePick.start <= key ? [rangePick.start, key] : [key, rangePick.start];
    onChange((cal) => ({
      ...cal,
      ranges: [
        ...cal.ranges,
        { id: makeId(), start, end, color: RANGE_COLORS[cal.ranges.length % RANGE_COLORS.length], label: "" },
      ],
    }));
    setRangePick(null);
    setHoverKey(null);
  };

  const startPaint = (key) => {
    if (rangePick) {
      pickRangeDay(key);
      return;
    }
    // Clicking a day that already has this color clears it.
    const clearing = activeBrush === ERASER || calendar.days[key] === activeBrush;
    paintRef.current = { id: clearing ? null : activeBrush };
    setDay(key, paintRef.current.id);
  };

  const continuePaint = (key) => {
    if (rangePick?.start) {
      setHoverKey(key);
    } else if (paintRef.current) {
      setDay(key, paintRef.current.id);
    }
  };

  const updateRange = (id, patch) => {
    onChange((cal) => ({
      ...cal,
      ranges: cal.ranges.map((range) => (range.id === id ? { ...range, ...patch } : range)),
    }));
  };

  const removeRange = (id) => {
    onChange((cal) => ({ ...cal, ranges: cal.ranges.filter((range) => range.id !== id) }));
  };

  // Days covered by the range being picked (start to hovered day), for a live preview.
  const preview =
    rangePick?.start && hoverKey
      ? rangePick.start <= hoverKey
        ? [rangePick.start, hoverKey]
        : [hoverKey, rangePick.start]
      : rangePick?.start
        ? [rangePick.start, rangePick.start]
        : null;

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

  const lanes = assignLanes(calendar.ranges);

  const counts = {};
  for (const [key, id] of Object.entries(calendar.days)) {
    if (key >= RANGE_KEYS.start && key <= RANGE_KEYS.end) {
      counts[id] = (counts[id] || 0) + 1;
    }
  }

  if (collapsed) {
    return (
      <aside className={`goal-cal ${collapseStyles.rail}`} aria-label="Calendar (collapsed)">
        <button
          type="button"
          className={collapseStyles.toggle}
          aria-expanded="false"
          aria-label="Expand calendar"
          title="Expand calendar"
          ref={toggleRef}
          onClick={toggleCollapsed}
        >
          <Chevron direction="right" />
        </button>
        <div className={collapseStyles.railCount} title={`${daysLeft ?? "–"} days til ${END_LABEL}`}>
          <span className={collapseStyles.railNumber}>{daysLeft ?? "–"}</span>
          <span className={collapseStyles.railLabel}>days</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="goal-cal" aria-label="Calendar">
      <div className={`goal-cal-countdown ${collapseStyles.countdown}`}>
        {onToggleCollapsed ? (
          <button
            type="button"
            className={collapseStyles.toggle}
            aria-expanded="true"
            aria-label="Collapse calendar"
            title="Collapse calendar"
            ref={toggleRef}
            onClick={toggleCollapsed}
          >
            <Chevron direction="left" />
          </button>
        ) : null}
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
                const isPast = todayKey !== null && key < todayKey;
                const covering = calendar.ranges.filter((range) => key >= range.start && key <= range.end);
                const inPreview = preview && key >= preview[0] && key <= preview[1];
                const labels = [item?.label, ...covering.map((range) => range.label)].filter(Boolean);
                return (
                  <button
                    type="button"
                    key={key}
                    className={`goal-cal-day${isToday ? " is-today" : ""}${isFirst ? " is-first" : ""}${
                      isPast ? " is-past" : ""
                    }${inPreview ? " is-range-preview" : ""}`}
                    style={item ? { backgroundColor: item.color } : undefined}
                    aria-label={`${key}${labels.length ? `: ${labels.join(", ")}` : item ? ": colored" : ""}`}
                    title={labels.join(" · ") || undefined}
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
                    {isPast ? (
                      // An SVG stroke, not a CSS gradient, so dark-mode extensions keep it visible.
                      <svg className="goal-cal-x" viewBox="0 0 10 10" aria-hidden="true">
                        <path d="M1.5 1.5 8.5 8.5M8.5 1.5 1.5 8.5" />
                      </svg>
                    ) : null}
                    {covering.length ? (
                      <span className="goal-cal-strips" aria-hidden="true">
                        {covering.map((range) => {
                          const lane = lanes.get(range.id);
                          if (lane >= MAX_STRIPS) {
                            return null;
                          }
                          // Reach across the gap to neighbors in the same week row and column.
                          const columnKeys = COLUMN_KEYS[columnIndex];
                          const joinLeft = key > range.start && date.getDay() !== 0 && key !== columnKeys.start;
                          const joinRight = key < range.end && date.getDay() !== 6 && key !== columnKeys.end;
                          return (
                            <i
                              key={range.id}
                              className={`${joinLeft ? "join-l" : ""} ${joinRight ? "join-r" : ""}`.trim() || undefined}
                              style={{ backgroundColor: range.color, bottom: `${3 + lane * 6}px` }}
                            />
                          );
                        })}
                      </span>
                    ) : null}
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

      <div className="goal-ranges">
        <p className="goal-legend-title">highlights · date ranges drawn as strips under the days</p>
        {calendar.ranges.map((range) => (
          <div className="goal-legend-row goal-range-row" key={range.id}>
            <input
              type="color"
              className="goal-legend-color"
              value={range.color}
              aria-label="Change highlight color"
              onChange={(event) => updateRange(range.id, { color: event.target.value })}
            />
            <input
              type="text"
              className="goal-legend-label"
              value={range.label}
              placeholder="label"
              maxLength={60}
              onChange={(event) => updateRange(range.id, { label: event.target.value })}
            />
            <span className="goal-range-dates">
              {range.start === range.end ? shortDate(range.start) : `${shortDate(range.start)} – ${shortDate(range.end)}`}
            </span>
            <button
              type="button"
              className="goal-legend-remove"
              aria-label={`Remove ${range.label || "highlight"}`}
              onClick={() => removeRange(range.id)}
            >
              ×
            </button>
          </div>
        ))}
        <div className="goal-legend-tools">
          <button
            type="button"
            className={rangePick ? "is-active" : undefined}
            disabled={!rangePick && calendar.ranges.length >= 50}
            onClick={() => {
              setRangePick(rangePick ? null : { start: null });
              setHoverKey(null);
            }}
          >
            {!rangePick
              ? "+ highlight range"
              : rangePick.start
                ? `pick end day (from ${shortDate(rangePick.start)}) · cancel`
                : "pick start day · cancel"}
          </button>
        </div>
      </div>
    </aside>
  );
}
