import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Clock, Plus } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");

function nowHHMM() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Wheel({
  value,
  max,
  ariaLabel,
  onShift,
}: {
  value: number;
  max: number;
  ariaLabel: string;
  onShift: (delta: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shiftRef = useRef(onShift);

  useEffect(() => {
    shiftRef.current = onShift;
  });

  // Нативный non-passive listener: React-овый onWheel passive, preventDefault в нём не работает.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      shiftRef.current(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={ref}
      className="tl-wheel"
      role="spinbutton"
      aria-label={ariaLabel}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      title="Прокрутите колёсиком"
    >
      <button type="button" tabIndex={-1} aria-label="Больше" className="tl-wheel-chev" onClick={() => onShift(-1)}>
        <ChevronUp size={13} strokeWidth={1.75} />
      </button>
      <span className="tl-wheel-val text-lg">{pad(value)}</span>
      <button type="button" tabIndex={-1} aria-label="Меньше" className="tl-wheel-chev" onClick={() => onShift(1)}>
        <ChevronDown size={13} strokeWidth={1.75} />
      </button>
    </div>
  );
}

function partOfDay(hhmm: string) {
  const h = Number(hhmm.slice(0, 2));
  return h < 5 ? "ночь" : h < 12 ? "утро" : h < 18 ? "день" : "вечер";
}

export function TimePicker({
  label,
  value,
  onChange,
  placeholder = "--:--",
  variant = "capsule",
  className = "",
}: {
  label?: string;
  value: string;
  onChange: (hhmm: string) => void;
  placeholder?: string;
  variant?: "capsule" | "tile";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const [h, m] = value ? value.split(":").map(Number) : [0, 0];
  const set = (hh: number, mm: number) => onChange(`${pad(hh)}:${pad(mm)}`);

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      <div ref={ref} className="relative">
        <button
          type="button"
          aria-expanded={open}
          aria-label={variant === "tile" ? (value ? `Время ${value}` : "Добавить время") : undefined}
          onClick={() => {
            if (!value) onChange(nowHHMM());
            setOpen((o) => !o);
          }}
          className={`flex w-full cursor-pointer items-center text-app-text transition-colors duration-150 ease-[var(--rg-ease)] ${
            variant === "tile" ? "h-16 gap-3 px-4 text-left outline-none" : "h-11 gap-2 rounded-full px-4 text-sm"
          } ${open ? "bg-surface-active" : "bg-surface-2 hover:bg-surface-3 focus-visible:bg-surface-3"} ${className}`}
        >
          {variant === "tile" ? (
            value ? (
              <>
                <span className="text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums">{value}</span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold">время</span>
                  <span className="truncate text-xs text-muted">{partOfDay(value)}</span>
                </span>
              </>
            ) : (
              <span className="flex flex-1 items-center justify-center gap-2 text-sm font-medium text-muted">
                <Plus size={16} strokeWidth={1.75} />
                Время
              </span>
            )
          ) : (
            <>
              <Clock size={15} className="shrink-0 text-muted" />
              <span className={`flex-1 text-left tabular-nums ${value ? "" : "text-muted"}`}>
                {value || placeholder}
              </span>
            </>
          )}
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-2 rounded-3xl bg-surface-2 p-2 shadow-lg">
            <div className="flex items-center gap-1">
              <Wheel value={h} max={23} ariaLabel="Часы" onShift={(d) => set((h + d + 24) % 24, m)} />
              <span className="text-lg text-muted">:</span>
              <Wheel value={m} max={59} ariaLabel="Минуты" onShift={(d) => set(h, (m + d + 60) % 60)} />
            </div>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-1 w-full cursor-pointer rounded-xl px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface-3 hover:text-app-text"
            >
              Без времени
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
