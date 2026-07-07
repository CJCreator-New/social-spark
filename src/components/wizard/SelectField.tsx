import React from "react";

export function Caret() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 11 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4l3 3 3-3" />
    </svg>
  );
}

interface SelectFieldProps {
  label: string;
  options: (string | { value: string; label: string })[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string | null;
  hint?: string;
}

export function SelectField({
  label,
  options,
  value,
  onChange,
  placeholder,
  hint,
}: SelectFieldProps) {
  const selectId = React.useId();
  return (
    <div>
      <label className="flabel" htmlFor={selectId}>
        {label}
        {hint && <span className="fhint">{hint}</span>}
      </label>
      <div className="swrap">
        <select
          id={selectId}
          className="sel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {placeholder !== null && <option value="">{placeholder || "Select…"}</option>}
          {options.map((o) => {
            const val = typeof o === "string" ? o : o.value;
            const lbl = typeof o === "string" ? o : o.label;
            return (
              <option key={val} value={val}>
                {lbl}
              </option>
            );
          })}
        </select>
        <span className="sarrow">
          <Caret />
        </span>
      </div>
    </div>
  );
}
