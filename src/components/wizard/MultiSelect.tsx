import React, { useState, useRef, useEffect } from "react";
import { Caret } from "./SelectField";

function Check() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground">
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
  disabled?: boolean;
}

export function MultiSelect({ label, options, value, onChange, placeholder, max = 6, hint, disabledOptions = [], disabled = false }: MultiSelectProps) {
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
    if (disabled || disabledOptions.includes(v)) return;
    if (value.includes(v)) onChange(value.filter(x => x !== v));
    else if (value.length < max) onChange([...value, v]);
  };
  return (
    <div>
      <div className="flabel">{label}{hint && <span className="fhint">{hint}</span>}</div>
      <div className="mswrap" ref={ref}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
          className={`msbox ${open ? "open" : ""} ${disabled ? "disabled" : ""} focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent focus:outline-none`}
          onClick={() => !disabled && setOpen(o => !o)}
          style={{ textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}
        >
          {value.length === 0
            ? <span className="ms-ph">{placeholder || "Select…"}</span>
            : value.map(v => (
              <span key={v} className="ms-tag" title={v}>
                <span className="ms-tag-text">{v}</span>
                <button
                  type="button"
                  aria-label={`Remove ${v}`}
                  className="ms-x"
                  onClick={e => { e.stopPropagation(); toggle(v); }}
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
                >
                  ×
                </button>
              </span>
            ))}
          <span className="ms-caret"><Caret /></span>
        </button>
        {open && !disabled && (
          <div className="ms-drop" role="listbox" aria-multiselectable="true">
            {options.map(o => {
              const isDisabledOption = disabledOptions.includes(o);
              if (isDisabledOption) {
                return (
                  <div key={o} className="ms-opt" style={{ opacity: 0.5, cursor: "default", fontStyle: "italic" }} onClick={e => e.stopPropagation()}>
                    {o}
                  </div>
                );
              }
              const isSelected = value.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`ms-opt ${isSelected ? "sel" : ""} focus:bg-secondary focus:outline-none`}
                  onClick={() => toggle(o)}
                  style={{ textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', background: 'none', color: 'inherit', font: 'inherit' }}
                >
                  {o}
                  <span className="ms-chk">{isSelected && <Check />}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
