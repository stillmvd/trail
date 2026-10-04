import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BellRing, Check, ChevronLeft, ChevronRight, Clock, Minus, Plus, Repeat } from "lucide-react";
import { REPEAT_OPTIONS, type RepeatKind, type RepeatUnit } from "@/lib/reminders";
import { DAYS, pluralRu, type PluralForms } from "@/lib/duration";
import { Switch } from "@/components/ui/Switch";
import { SheetLayer, SheetPanel } from "@/components/ui/SheetPanel";

const WEEKS: PluralForms = ["неделю", "недели", "недель"];
const HOURS: PluralForms = ["час", "часа", "часов"];
const MINUTES: PluralForms = ["минуту", "минуты", "минут"];
const PRE_PRESETS = [0, 5, 15, 30, 60, 1440];
const NAG_PRESETS = [5, 10, 15, 30, 60];

const round =
  "grid h-[30px] w-[30px] shrink-0 cursor-pointer place-items-center rounded-full text-app-text transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-active active:scale-[0.92] disabled:pointer-events-none disabled:opacity-30";

export function repeatLabel(repeat: RepeatKind, every: number, unit: RepeatUnit) {
  if (repeat !== "custom") return REPEAT_OPTIONS.find((o) => o.value === repeat)?.label ?? "";
  if (every === 1) return unit === "day" ? "Каждый день" : "Каждую неделю";
  return `Каждые ${every} ${pluralRu(every, unit === "day" ? DAYS : WEEKS)}`;
}

function preLabel(min: number) {
  if (min === 0) return "В момент";
  if (min % 1440 === 0) return `За ${min / 1440} ${pluralRu(min / 1440, DAYS)}`;
  if (min % 60 === 0) return `За ${min / 60} ${pluralRu(min / 60, HOURS)}`;
  return `За ${min} мин`;
}

export function SettingsStack({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 [&>*]:rounded-xs [&>*:first-child]:rounded-t-3xl [&>*:last-child]:rounded-b-3xl">
      {children}
    </div>
  );
}

function Row({ icon, caption, value, tail }: { icon: ReactNode; caption: string; value?: string; tail?: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-3 pl-0.5 pr-1">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-3 text-app-text">{icon}</span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="whitespace-nowrap text-xs text-muted">{caption}</span>
        {value && <span className="truncate text-[15px] font-semibold text-app-text">{value}</span>}
      </span>
      {tail && <span className="ml-auto flex shrink-0 items-center">{tail}</span>}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <span className="flex items-center gap-0.5 rounded-full bg-surface-3 p-[3px]">
      <button type="button" aria-label="Меньше" className={round} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={14} strokeWidth={1.75} />
      </button>
      <span className="min-w-[34px] text-center text-base font-bold tabular-nums text-app-text">{value}</span>
      <button type="button" aria-label="Больше" className={round} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={14} strokeWidth={1.75} />
      </button>
    </span>
  );
}

function RepeatScreen({
  repeat,
  every,
  unit,
  onChange,
  onClose,
}: {
  repeat: RepeatKind;
  every: number;
  unit: RepeatUnit;
  onChange: (repeat: RepeatKind, every: number, unit: RepeatUnit) => void;
  onClose: () => void;
}) {
  return (
    <SheetPanel title="Повтор" label="Повтор" onBack={onClose}>
      <div className="flex flex-col gap-0.5">
        {REPEAT_OPTIONS.map((o) => {
          const active = o.value === repeat;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onChange(o.value, every, unit);
                if (o.value !== "custom") onClose();
              }}
              className={`flex h-13 w-full shrink-0 cursor-pointer items-center gap-3 rounded-xs px-4 text-left text-[15px] font-medium text-app-text transition-[background-color] duration-150 ease-[var(--rg-ease)] first:rounded-t-3xl last:rounded-b-3xl ${
                active ? "bg-surface-active" : "bg-surface-2 hover:bg-surface-3 focus-visible:bg-surface-3"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">
                {o.value === "custom" && active ? repeatLabel(repeat, every, unit) : o.label}
              </span>
              {active && <Check size={18} strokeWidth={1.75} className="shrink-0" />}
            </button>
          );
        })}
      </div>
      {repeat === "custom" && (
        <div className="flex items-center gap-2 rounded-3xl bg-surface-2 p-3">
          <span className="px-1 text-sm text-muted">Каждые</span>
          <Stepper value={every} min={1} max={365} onChange={(v) => onChange(repeat, v, unit)} />
          <span className="ml-auto flex gap-0.5 rounded-full bg-surface-3 p-[3px]">
            {(
              [
                ["day", "дней"],
                ["week", "недель"],
              ] as const
            ).map(([u, l]) => (
              <button
                key={u}
                type="button"
                aria-pressed={unit === u}
                onClick={() => onChange(repeat, every, u)}
                className={`h-[30px] cursor-pointer rounded-full px-3 text-[12.5px] transition-colors duration-150 ease-[var(--rg-ease)] ${
                  unit === u ? "bg-surface-active font-semibold text-app-text" : "text-muted hover:text-app-text"
                }`}
              >
                {l}
              </button>
            ))}
          </span>
        </div>
      )}
    </SheetPanel>
  );
}

export function RepeatBlock({
  repeat,
  every,
  unit,
  onChange,
}: {
  repeat: RepeatKind;
  every: number;
  unit: RepeatUnit;
  onChange: (repeat: RepeatKind, every: number, unit: RepeatUnit) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer bg-surface-2 p-3 text-left outline-none transition-colors duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 focus-visible:bg-surface-3"
      >
        <Row
          icon={<Repeat size={16} strokeWidth={1.75} />}
          caption="Повтор"
          value={repeatLabel(repeat, every, unit)}
          tail={<ChevronRight size={18} strokeWidth={1.75} className="text-muted" />}
        />
      </button>
      <SheetLayer open={open} onExitComplete={() => ref.current?.focus()}>
        <RepeatScreen
          key="repeat"
          repeat={repeat}
          every={every}
          unit={unit}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      </SheetLayer>
    </>
  );
}

export function PreNotifyBlock({ value, onChange }: { value: number; onChange: (min: number) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const next = PRE_PRESETS.find((p) => p > value);
  const prev = [...PRE_PRESETS].reverse().find((p) => p < value);
  const shiftRef = useRef((_d: number) => {});

  useEffect(() => {
    shiftRef.current = (d: number) => {
      const target = d > 0 ? next : prev;
      if (target !== undefined) onChange(target);
    };
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
    <div className="bg-surface-2 p-3">
      <Row
        icon={<Clock size={16} strokeWidth={1.75} />}
        caption="Напомнить заранее"
        tail={
          <span
            ref={ref}
            role="spinbutton"
            aria-label="Напомнить заранее"
            aria-valuenow={value}
            aria-valuetext={preLabel(value)}
            className="flex items-center gap-1"
          >
            <button
              type="button"
              aria-label="Раньше"
              className={`${round} bg-surface-3`}
              disabled={prev === undefined}
              onClick={() => prev !== undefined && onChange(prev)}
            >
              <ChevronLeft size={14} strokeWidth={1.75} />
            </button>
            <span className="min-w-[84px] text-center text-sm font-semibold text-app-text">{preLabel(value)}</span>
            <button
              type="button"
              aria-label="Позже"
              className={`${round} bg-surface-3`}
              disabled={next === undefined}
              onClick={() => next !== undefined && onChange(next)}
            >
              <ChevronRight size={14} strokeWidth={1.75} />
            </button>
          </span>
        }
      />
    </div>
  );
}

export function NagBlock({
  nag,
  interval,
  onNag,
  onInterval,
}: {
  nag: boolean;
  interval: number;
  onNag: (nag: boolean) => void;
  onInterval: (min: number) => void;
}) {
  return (
    <div className="bg-surface-2 p-3">
      <Row
        icon={<BellRing size={16} strokeWidth={1.75} />}
        caption="Пока не выполню"
        value={nag ? `Каждые ${interval} ${pluralRu(interval, MINUTES)}` : "Напоминать снова"}
        tail={<Switch label="Напоминать снова, пока не выполню" checked={nag} onChange={onNag} />}
      />
      <AnimatePresence initial={false}>
        {nag && (
          <motion.div
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          >
            <div className="grid grid-cols-5 gap-1 pt-2.5">
              {NAG_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={interval === n}
                  onClick={() => onInterval(n)}
                  className={`h-9 cursor-pointer rounded-xl text-[13px] transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
                    interval === n
                      ? "bg-surface-active font-semibold text-app-text"
                      : "font-medium text-muted hover:bg-surface-3 hover:text-app-text"
                  }`}
                >
                  {n} мин
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
