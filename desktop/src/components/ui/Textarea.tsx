import type { TextareaHTMLAttributes } from "react";

export function Textarea({
  label,
  value,
  onChange,
  error,
  className = "",
  rows = 3,
  ...rest
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange">) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={`resize-y rounded-3xl bg-surface-2 px-4 py-3 text-sm text-app-text outline-none placeholder:text-muted ${
          error ? "shadow-[inset_0_0_0_1.5px_var(--ds-danger)]" : ""
        } ${className}`}
        {...rest}
      />
      {error && <span className="text-xs text-rust">{error}</span>}
    </label>
  );
}
