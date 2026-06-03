import React, { useState, useRef, useEffect } from "react";
import { Caret } from "./SelectField";

function Check() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="#07080d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 4.5L3.5 6.5L7.5 2.5" />
    </svg>
  );
}

interface MultiSelectProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  hint?: string;
  disabledOptions?: string[];
}

export function MultiSelect({ label, options, value, onChange, placeholder, max = 6, hint, disabledOptions = [] }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  const toggle = (v: string) => {
    if (disabledOptions.includes(v)) return;
    if (value.includes(v)) onChange(value.filter(x => x !== v));
    else if (value.length < max) onChange([...value, v]);
  };
  return (
    <div>
      <div className="flabel">{label}{hint && <span className="fhint">{hint}</span>}</div>
      <div className="mswrap" ref={ref}>
        <div className={`msbox ${open ? "open" : ""}`} onClick={() => setOpen(o => !o)}>
          {value.length === 0
            ? <span className="ms-ph">{placeholder || "Select…"}</span>
            : value.map(v => (
              <span key={v} className="ms-tag" title={v}>
                <span className="ms-tag-text">{v}</span>
                <span className="ms-x" onClick={e => { e.stopPropagation(); toggle(v); }}>×</span>
              </span>
            ))}
          <span className="ms-caret"><Caret /></span>
        </div>
        {open && (
          <div className="ms-drop">
            {options.map(o => {
              const disabled = disabledOptions.includes(o);
              if (disabled) {
                return (
                  <div key={o} className="ms-opt" style={{ opacity: 0.5, cursor: "default", fontStyle: "italic" }} onClick={e => e.stopPropagation()}>
                    {o}
                  </div>
                );
              }
              return (
                <div key={o} className={`ms-opt ${value.includes(o) ? "sel" : ""}`} onClick={() => toggle(o)}>
                  {o}
                  <span className="ms-chk">{value.includes(o) && <Check />}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
