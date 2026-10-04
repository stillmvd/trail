import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import { DayPicker, type DayProps, type MonthCaptionProps } from "react-day-picker";
import { ru } from "date-fns/locale";
import { parseISO, format, startOfMonth, endOfMonth, isSameMonth } from "date-fns";
import { CalendarDays, Cake } from "lucide-react";
import "react-day-picker/style.css";
import { onColorFor } from "@/lib/colors";
import { eventAccent } from "@/lib/accent";
import { resolveIconOrNull } from "@/lib/icons";
import { mediaSrc } from "@/lib/paths";
import {
  EMPTY_FILTER,
  isFilterActive,
  matchesFilter,
  matchesMarkFilter,
  type EventFilter,
} from "@/lib/filter";
import { BIRTH_DATE } from "@/lib/constants";
import { isFuture } from "@/lib/duration";
import { holidayName } from "@/lib/holidays";
import { getNonWorkingISO } from "@/lib/workcalendar";
import type { TimelineEvent } from "@/db/queries/events";
import type { Mark } from "@/db/queries/marks";
import { WheelField } from "@/components/ui/WheelField";
import type { Person } from "@/db/queries/people";

type Anchor = { x: number; y: number };

const START_MONTH = parseISO(BIRTH_DATE);
const MAX_CHIPS = 3;

// Горизонт будущего: «напоминания» можно листать на 15 лет вперёд от сегодня.
const FUTURE_HORIZON_YEARS = 15;

const ELEVATION_1 = "var(--ds-shadow-1)";

// Допустимый диапазон месяцев (0–11) для года в пределах [START_MONTH … limit].
function monthBounds(limit: Date, year: number): { lo: number; hi: number } {
  const lo = year === START_MONTH.getFullYear() ? START_MONTH.getMonth() : 0;
  const hi = year === limit.getFullYear() ? limit.getMonth() : 11;
  return { lo, hi };
}

// Линейный сдвиг месяца с переносом года; кламп [START_MONTH … limit].
function stepMonth(limit: Date, current: Date, delta: number): Date {
  const next = new Date(current.getFullYear(), current.getMonth() + delta, 1);
  const lo = new Date(START_MONTH.getFullYear(), START_MONTH.getMonth(), 1);
  const hi = new Date(limit.getFullYear(), limit.getMonth(), 1);
  return next < lo ? lo : next > hi ? hi : next;
}

// Сдвиг года с клампом по диапазону [START_MONTH … limit].
function shiftYear(limit: Date, current: Date, delta: number): Date {
  const minY = START_MONTH.getFullYear();
  const maxY = limit.getFullYear();
  const year = Math.min(Math.max(current.getFullYear() + delta, minY), maxY);
  const { lo, hi } = monthBounds(limit, year);
  const m = Math.min(Math.max(current.getMonth(), lo), hi);
  return new Date(year, m, 1);
}

type DayIndex = Map<string, TimelineEvent[]>;
type MarkIndex = Map<string, Mark[]>;
// Ключ «MM-DD»: годовщина повторяется в любом году, поэтому год отбрасываем.
type BirthdayIndex = Map<string, Person[]>;

function buildBirthdayIndex(people: Person[]): BirthdayIndex {
  const map: BirthdayIndex = new Map();
  for (const p of people) {
    const key = p.birth_date.slice(5);
    const bucket = map.get(key);
    if (bucket) bucket.push(p);
    else map.set(key, [p]);
  }
  return map;
}

const isPeriod = (e: TimelineEvent) => !!e.end_date && e.end_date > e.date;

const anchorFrom = (e: { clientX: number; currentTarget: HTMLElement }): Anchor => {
  const rect = e.currentTarget.getBoundingClientRect();
  return { x: e.clientX, y: rect.top + rect.height / 2 };
};

// Индекс «день → события». Только разовые — события-периоды в календаре не показываем.
function buildDayIndex(events: TimelineEvent[], filter: EventFilter): DayIndex {
  const filterOn = isFilterActive(filter);
  const map: DayIndex = new Map();
  const push = (key: string, e: TimelineEvent) => {
    const bucket = map.get(key);
    if (bucket) bucket.push(e);
    else map.set(key, [e]);
  };
  for (const e of events) {
    if (filterOn && !matchesFilter(e, filter)) continue;
    if (isPeriod(e)) continue;
    push(e.date, e);
  }
  // Важные сверху — при переполнении первыми обрезаются менее значимые.
  for (const bucket of map.values()) {
    bucket.sort((a, b) => b.significance - a.significance || b.id - a.id);
  }
  return map;
}

// Индекс «день → отметки» (быстрый лог без названия, рендерятся иконкой).
function buildMarkIndex(marks: Mark[], filter: EventFilter): MarkIndex {
  const filterOn = isFilterActive(filter);
  const map: MarkIndex = new Map();
  for (const m of marks) {
    if (filterOn && !matchesMarkFilter(m, filter)) continue;
    const bucket = map.get(m.date);
    if (bucket) bucket.push(m);
    else map.set(m.date, [m]);
  }
  return map;
}

type CalCtx = {
  dayIndex: DayIndex;
  markIndex: MarkIndex;
  birthdayIndex: BirthdayIndex;
  onEventOpen: (event: TimelineEvent) => void;
  onCreateAt: (iso: string, anchor: Anchor) => void;
  onDayOpen: (iso: string) => void;
  onMarkOpen: (iso: string) => void;
  onMarkMenu: (mark: Mark, x: number, y: number) => void;
  onPersonOpen: (person: Person) => void;
  displayMonth: Date;
  onShift: (unit: "month" | "year", delta: number) => void;
  onToday: () => void;
  isTodayMonth: boolean;
  dayKind: (iso: string, date: Date, disabled: boolean) => "" | "weekend" | "holiday";
};

const CalendarContext = createContext<CalCtx>({
  dayIndex: new Map(),
  markIndex: new Map(),
  birthdayIndex: new Map(),
  onEventOpen: () => {},
  onCreateAt: () => {},
  onDayOpen: () => {},
  onMarkOpen: () => {},
  onMarkMenu: () => {},
  onPersonOpen: () => {},
  displayMonth: new Date(0),
  onShift: () => {},
  onToday: () => {},
  isTodayMonth: true,
  dayKind: () => "",
});

function EventMarker({ event }: { event: TimelineEvent }) {
  if (!event.cover) return null;
  return (
    <img
      src={mediaSrc(event.cover)}
      alt=""
      loading="lazy"
      decoding="async"
      className="tl-cal-chip-thumb"
    />
  );
}

// Кастомная ячейка-gridcell: число + чипы событий (НЕ DayButton — чипы не вложены в button).
function DayCell({ day, modifiers, className, ...rest }: DayProps) {
  const {
    dayIndex,
    markIndex,
    birthdayIndex,
    onEventOpen,
    onCreateAt,
    onDayOpen,
    onMarkOpen,
    onMarkMenu,
    onPersonOpen,
    dayKind,
  } = useContext(CalendarContext);
  const dayEvents = modifiers.disabled ? [] : dayIndex.get(day.isoDate) ?? [];
  const dayMarks = modifiers.disabled ? [] : markIndex.get(day.isoDate) ?? [];
  const dayBirthdays = modifiers.disabled ? [] : birthdayIndex.get(day.isoDate.slice(5)) ?? [];
  const shown = dayEvents.slice(0, MAX_CHIPS);
  const extra = dayEvents.length - shown.length;
  const kind = dayKind(day.isoDate, day.date, !!modifiers.disabled);
  const holiday = kind === "holiday" ? holidayName(day.isoDate) : null;
  // Будущий день — приглушаем чипы/маркеры (событие ещё не наступило).
  const future = !modifiers.disabled && isFuture(day.isoDate);

  return (
    <td {...(rest as HTMLAttributes<HTMLTableCellElement>)} className={`${className ?? ""} tl-cal-td`}>
      <div
        onClick={
          modifiers.disabled
            ? undefined
            : (e) =>
                dayEvents.length > 0 || dayMarks.length > 0
                  ? onDayOpen(day.isoDate)
                  : onCreateAt(day.isoDate, anchorFrom(e))
        }
        title={holiday ?? undefined}
        className={`tl-cal-cell${modifiers.today ? " is-today" : ""}${
          modifiers.disabled ? " is-disabled" : ""
        }${kind ? ` is-${kind}` : ""}`}
      >
        <div className="tl-cal-head">
          <span className="tl-cal-num">{day.date.getDate()}</span>
          {dayBirthdays.length > 0 && (
            <div className="tl-cal-marks">
              {dayBirthdays.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="tl-cal-mark"
                  title={`День рождения — ${p.name}`}
                  style={{
                    background: "var(--rg-amber)",
                    color: "var(--rg-bg)",
                  }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onPersonOpen(p);
                  }}
                >
                  <Cake size={11} strokeWidth={1.75} />
                </button>
              ))}
            </div>
          )}
          {dayMarks.length > 0 && (
            <div className="tl-cal-marks" style={{ opacity: future ? 0.5 : undefined }}>
              {dayMarks.slice(0, 3).map((m) => {
                const Icon = resolveIconOrNull(m.type_icon);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="tl-cal-mark"
                    title={m.type_name}
                    style={{ background: m.type_color, color: onColorFor(m.type_color) }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onMarkOpen(day.isoDate);
                    }}
                    onContextMenu={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      onMarkMenu(m, ev.clientX, ev.clientY);
                    }}
                  >
                    {Icon && createElement(Icon, { size: 11 })}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {shown.length > 0 && (
          <div className="tl-cal-chips" style={{ opacity: future ? 0.5 : undefined }}>
            {shown.map((e) => {
              const accent = eventAccent(e);
              return (
                <button
                  key={e.id}
                  type="button"
                  className="tl-cal-chip"
                  style={{ background: "var(--ds-surface-1)" }}
                  title={e.title}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onEventOpen(e);
                  }}
                >
                  {e.cover ? (
                    <EventMarker event={e} />
                  ) : (
                    <span className="tl-cal-chip-dot" style={{ background: accent.fill }} />
                  )}
                  <span className="tl-cal-chip-title">{e.title}</span>
                </button>
              );
            })}
            {extra > 0 && (
              <button
                type="button"
                className="tl-cal-more"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onDayOpen(day.isoDate);
                }}
              >
                +{extra}
              </button>
            )}
          </div>
        )}
      </div>
    </td>
  );
}

function MonthCaption({ calendarMonth, displayIndex, ...rest }: MonthCaptionProps) {
  const { displayMonth, onShift, onToday, isTodayMonth } = useContext(CalendarContext);
  void calendarMonth;
  void displayIndex;
  return (
    <div {...rest} className={`${rest.className ?? ""} tl-cal-caption`}>
      <div className="tl-cal-caption-fields">
        <WheelField
          isMonth
          label={format(displayMonth, "LLLL", { locale: ru })}
          ariaLabel="Месяц"
          onShift={(d) => onShift("month", d)}
        />
        <WheelField
          label={format(displayMonth, "yyyy")}
          ariaLabel="Год"
          onShift={(d) => onShift("year", d)}
        />
      </div>
      {!isTodayMonth && (
        <button type="button" className="tl-cal-today" onClick={onToday}>
          <CalendarDays size={15} strokeWidth={1.75} />
          Сегодня
        </button>
      )}
    </div>
  );
}

const COMPONENTS = { Day: DayCell, MonthCaption };

export function CalendarView({
  events,
  marks = [],
  people = [],
  filter = EMPTY_FILTER,
  onEventClick = () => {},
  onCreateRequest = () => {},
  onDayOpen = () => {},
  onMarkOpen = () => {},
  onMarkMenu = () => {},
  onPersonOpen = () => {},
}: {
  events: TimelineEvent[];
  marks?: Mark[];
  people?: Person[];
  filter?: EventFilter;
  onFilterChange?: (filter: EventFilter) => void;
  onEventClick?: (event: TimelineEvent) => void;
  onCreateRequest?: (dateISO: string, anchor: Anchor) => void;
  onDayOpen?: (dateISO: string) => void;
  onMarkOpen?: (dateISO: string) => void;
  onMarkMenu?: (mark: Mark, x: number, y: number) => void;
  onPersonOpen?: (person: Person) => void;
}) {
  const today = useMemo(() => new Date(), []);
  // Верхняя граница навигации/создания: сегодня + горизонт будущего.
  const limit = useMemo(() => {
    const d = new Date(today);
    d.setFullYear(d.getFullYear() + FUTURE_HORIZON_YEARS);
    return d;
  }, [today]);
  const maxDay = useMemo(() => endOfMonth(limit), [limit]);
  const [month, setMonth] = useState<Date>(() => new Date());
  const dayIndex = useMemo(() => buildDayIndex(events, filter), [events, filter]);
  const markIndex = useMemo(() => buildMarkIndex(marks, filter), [marks, filter]);
  const birthdayIndex = useMemo(() => buildBirthdayIndex(people), [people]);

  // Нерабочие дни (праздники + переносы РФ) по годам; null — данных нет, fallback на сб/вс.
  const displayYear = month.getFullYear();
  const [nonWork, setNonWork] = useState<Map<number, Set<string> | null>>(() => new Map());
  const loadedYears = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (loadedYears.current.has(displayYear)) return;
    loadedYears.current.add(displayYear);
    let cancelled = false;
    getNonWorkingISO(displayYear)
      .then((iso) => {
        if (cancelled) return;
        setNonWork((prev) => new Map(prev).set(displayYear, iso ? new Set(iso) : null));
      })
      .catch(() => loadedYears.current.delete(displayYear));
    return () => {
      cancelled = true;
    };
  }, [displayYear]);

  const dayKind = useCallback(
    (iso: string, date: Date, disabled: boolean): "" | "weekend" | "holiday" => {
      if (disabled) return "";
      if (holidayName(iso)) return "holiday";
      const set = nonWork.get(Number(iso.slice(0, 4)));
      const nonWorking = set ? set.has(iso) : date.getDay() === 0 || date.getDay() === 6;
      return nonWorking ? "weekend" : "";
    },
    [nonWork],
  );

  const handleShift = useCallback(
    (unit: "month" | "year", delta: number) => {
      setMonth((m) => (unit === "month" ? stepMonth(limit, m, delta) : shiftYear(limit, m, delta)));
    },
    [limit],
  );

  const handleToday = useCallback(() => setMonth(startOfMonth(today)), [today]);

  // Колесо над сеткой дней (не над шапкой) листает месяцы линейно: вверх — раньше, вниз — позже.
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest(".rdp-month_grid")) return;
      e.preventDefault();
      handleShift("month", e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [handleShift]);

  const ctx = useMemo<CalCtx>(
    () => ({
      dayIndex,
      markIndex,
      birthdayIndex,
      onEventOpen: onEventClick,
      onCreateAt: onCreateRequest,
      onDayOpen,
      onMarkOpen,
      onMarkMenu,
      onPersonOpen,
      displayMonth: month,
      onShift: handleShift,
      onToday: handleToday,
      isTodayMonth: isSameMonth(month, today),
      dayKind,
    }),
    [
      dayIndex,
      markIndex,
      birthdayIndex,
      onEventClick,
      onCreateRequest,
      onDayOpen,
      onMarkOpen,
      onMarkMenu,
      onPersonOpen,
      month,
      handleShift,
      handleToday,
      today,
      dayKind,
    ],
  );

  return (
    <div className="h-full w-full overflow-auto">
      <div className="flex min-h-full items-center justify-center p-6">
        <div
          ref={cardRef}
          className="tl-calendar tl-calendar-lg w-full max-w-[1500px] rounded-4xl p-6"
          style={{ background: "var(--ds-surface-1)", boxShadow: ELEVATION_1 }}
        >
        <CalendarContext.Provider value={ctx}>
          <DayPicker
            month={month}
            onMonthChange={setMonth}
            locale={ru}
            fixedWeeks
            captionLayout="label"
            startMonth={START_MONTH}
            endMonth={limit}
            disabled={[{ before: START_MONTH }, { after: maxDay }]}
            components={COMPONENTS}
            aria-label="Календарь событий"
          />
        </CalendarContext.Provider>
        </div>
      </div>
    </div>
  );
}
