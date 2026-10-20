"use client";

import { useEffect, useState } from "react";
import s from "@/components/kurashi/kurashi.module.css";

export function Segmented({ value, options, onChange, size = "md", label }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className={`${s.seg} ${size === "sm" ? s.segSm : ""}`} role="tablist" aria-label={label} style={{ "--n": options.length }}>
      <span className={s.segThumb} style={{ transform: `translateX(${index * 100}%)` }} />
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value}
          className={o.value === value ? s.segOn : undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A destructive button that asks once more in place instead of opening a dialog. */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = "" }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <button type="button" className={`${s.btn} ${s.btnDanger} ${armed ? s.btnArmed : ""} ${className}`}
      onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirmLabel : label}
    </button>
  );
}
