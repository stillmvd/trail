import type { InputHTMLAttributes } from "react";

export function Input({
  label,
  value,
  onChange,
  error,
  className = "",
  raised = false,
  ...rest
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  raised?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-11 rounded-full ${raised ? "bg-surface-3" : "bg-surface-2"} px-4 text-sm text-app-text outline-none placeholder:text-muted ${
          error ? "shadow-[inset_0_0_0_1.5px_var(--ds-danger)]" : ""
        } ${className}`}
        {...rest}
      />
      {error && <span className="text-xs text-rust">{error}</span>}
    </label>
  );
}
