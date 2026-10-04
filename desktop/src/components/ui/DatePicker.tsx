import { useEffect, useRef, useState } from "react";
import { DayPicker, useDayPicker, type MonthCaptionProps } from "react-day-picker";
import { ru } from "date-fns/locale";
import { parseISO, format, addMonths, startOfMonth } from "date-fns";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import "react-day-picker/style.css";
import { formatFullRu } from "@/lib/dates";
import { WheelField } from "./WheelField";

function CalCaption({ calendarMonth, minDate, maxDate }: MonthCaptionProps & { minDate?: Date; maxDate?: Date }) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker();
  const [yearsOpen, setYearsOpen] = useState(false);
  const date = calendarMonth.date;
  const year = date.getFullYear();
  const minYear = minDate ? minDate.getFullYear() : 1900;
  const maxYear = maxDate ? maxDate.getFullYear() : 2100;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

  function go(next: Date) {
    let target = startOfMonth(next);
    if (minDate && target < startOfMonth(minDate)) target = startOfMonth(minDate);
    if (maxDate && target > startOfMonth(maxDate)) target = startOfMonth(maxDate);
    goToMonth(target);
  }

  const navClass =
    "grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-surface-3 text-app-text transition-[opacity,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="mb-1 flex items-center gap-0.5 text-base font-bold">
      <WheelField
        label={format(date, "LLLL", { locale: ru })}
        ariaLabel="Месяц"
        isMonth
        onShift={(d) => go(addMonths(date, d))}
      />
      <button
        type="button"
        aria-expanded={yearsOpen}
        onClick={() => setYearsOpen((o) => !o)}
        className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 tabular-nums transition-colors hover:bg-surface-3"
      >
        {year}
        <ChevronDown size={14} strokeWidth={1.75} className="text-muted" />
      </button>
      <span className="flex-1" />
      <div className="flex gap-1.5">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          disabled={!previousMonth}
          onClick={() => previousMonth && goToMonth(previousMonth)}
          className={navClass}
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Следующий месяц"
          disabled={!nextMonth}
          onClick={() => nextMonth && goToMonth(nextMonth)}
          className={navClass}
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
      {yearsOpen && (
        <div className="absolute inset-0 z-10 grid grid-cols-4 content-start gap-1 overflow-y-auto rounded-4xl bg-surface-2 p-3.5">
          {years.map((y) => (
            <button
              key={y}
              ref={y === year ? (el) => el?.scrollIntoView({ block: "center" }) : undefined}
              type="button"
              onClick={() => {
                go(new Date(y, date.getMonth(), 1));
                setYearsOpen(false);
              }}
              className={`h-10 cursor-pointer rounded-full text-sm font-medium tabular-nums transition-colors ${
                y === year ? "bg-amber text-ink" : "text-app-text hover:bg-surface-3"
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  min,
  max,
  variant = "capsule",
  className = "",
  align = "start",
  defaultOpen = false,
  onClear,
}: {
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  min?: string;
  max?: string;
  variant?: "capsule" | "tile";
  className?: string;
  align?: "start" | "end";
  defaultOpen?: boolean;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? parseISO(value) : undefined;
  const minDate = min ? parseISO(min) : undefined;
  const maxDate = max ? parseISO(max) : undefined;

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

  const ring = error ? "shadow-[inset_0_0_0_1.5px_var(--ds-danger)]" : "";

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      <div ref={ref} className="relative">
        {variant === "tile" ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={`flex h-16 w-full cursor-pointer items-center gap-3 px-4 text-left text-app-text outline-none transition-[background-color,box-shadow] duration-150 ease-[var(--rg-ease)] ${
              open ? "bg-surface-active" : "bg-surface-2 hover:bg-surface-3 focus-visible:bg-surface-3"
            } ${
              onClear ? "pr-12" : ""
            } ${ring} ${className}`}
          >
            {selected ? (
              <>
                <span className="text-[30px] font-bold leading-none tracking-[-0.03em] tabular-nums">
                  {selected.getDate()}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold">{format(selected, "MMMM", { locale: ru })}</span>
                  <span className="truncate text-xs text-muted">
                    {format(selected, "yyyy, EEEEEE", { locale: ru })}
                  </span>
                </span>
              </>
            ) : (
              <span className="text-sm text-muted">Выберите дату</span>
            )}
          </button>
        ) : (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={`flex h-11 w-full cursor-pointer items-center gap-2 rounded-full border bg-surface-2 px-4 text-sm text-app-text outline-none transition focus:border-amber ${
              error ? "border-rust" : "border-line"
            } ${className}`}
          >
            <CalendarDays size={15} className="shrink-0 text-muted" />
            <span className={`flex-1 truncate text-left ${value ? "" : "text-muted"}`}>
              {value ? formatFullRu(value) : "Выберите дату"}
            </span>
          </button>
        )}
        {onClear && (
          <button
            type="button"
            aria-label="Убрать дату"
            onClick={onClear}
            className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface-3 text-muted transition-[color,scale] duration-150 ease-[var(--rg-ease)] hover:text-app-text active:scale-[0.96]"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        )}
        {open && (
          <div
            className={`tl-calendar absolute z-50 mt-2 w-[310px] rounded-4xl bg-surface-2 p-3.5 shadow-lg ${
              align === "end" ? "right-0" : "left-0"
            }`}
          >
            <DayPicker
              mode="single"
              locale={ru}
              hideNavigation
              selected={selected}
              defaultMonth={selected}
              startMonth={minDate}
              endMonth={maxDate}
              disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
              components={{
                MonthCaption: (props) => <CalCaption {...props} minDate={minDate} maxDate={maxDate} />,
              }}
              onSelect={(d) => {
                if (d) {
                  onChange(format(d, "yyyy-MM-dd"));
                  setOpen(false);
                }
              }}
            />
          </div>
        )}
      </div>
      {error && <span className="text-xs text-rust">{error}</span>}
    </div>
  );
}
