import React from "react";

export function Caret() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4l3 3 3-3" />
    </svg>
  );
}

interface SelectFieldProps {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}

export function SelectField({ label, options, value, onChange, placeholder, hint }: SelectFieldProps) {
  return (
    <div>
      <div className="flabel">{label}{hint && <span className="fhint">{hint}</span>}</div>
      <div className="swrap">
        <select className="sel" aria-label={label || "Select option"} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">{placeholder || "Select…"}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="sarrow"><Caret /></span>
      </div>
    </div>
  );
}
