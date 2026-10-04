import { createElement, useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { resolveIconOrNull } from "@/lib/icons";

export type SelectOption = {
  value: string;
  label: string;
  icon?: string | null;
  color?: string | null;
};

function OptionIcon({ opt }: { opt: SelectOption }) {
  const Icon = resolveIconOrNull(opt.icon);
  if (Icon) return createElement(Icon, { size: 15, style: { color: opt.color ?? undefined } });
  if (opt.color)
    return <span className="h-2.5 w-2.5 rounded-full" style={{ background: opt.color }} />;
  return null;
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = "—",
}: {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);

  // Списки лет и месяцев длиннее окна: без этого открываются с начала, на 2100 году.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const active = activeRef.current;
    if (!list || !active) return;
    list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.offsetHeight / 2;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex h-11 w-full cursor-pointer items-center gap-2 rounded-full px-4 text-sm text-app-text transition-colors duration-150 ease-[var(--rg-ease)] ${
            open ? "bg-surface-active" : "bg-surface-2 hover:bg-surface-3"
          }`}
        >
          {selected && <OptionIcon opt={selected} />}
          <span className={`flex-1 truncate text-left ${selected ? "" : "text-muted"}`}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
        </button>
        {open && (
          <div
            ref={listRef}
            className="absolute z-50 mt-1.5 max-h-64 w-full overflow-y-auto rounded-3xl bg-surface-2 p-1.5 shadow-lg"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                ref={opt.value === value ? activeRef : undefined}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-app-text transition-colors ${
                  opt.value === value ? "bg-surface-active" : "hover:bg-surface-3"
                }`}
              >
                <OptionIcon opt={opt} />
                <span className="flex-1 truncate">{opt.label}</span>
                {opt.value === value && <Check size={15} strokeWidth={1.75} className="shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
