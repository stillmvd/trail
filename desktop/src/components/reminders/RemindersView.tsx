import { createElement, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlarmClock, ArrowUpRight, Bell, Cake, ChevronRight, Moon, Sunset, Trash2 } from "lucide-react";
import { addDays, parseISO } from "date-fns";
import {
  toISO,
  formatRu,
  formatDayMonthRu,
  formatWeekdayShortRu,
  formatWeekdayFullRu,
} from "@/lib/dates";
import {
  effectiveDateISO,
  snoozePlusHour,
  snoozeEvening,
  snoozeTomorrow,
} from "@/lib/reminders";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { Dialog } from "@/components/ui/Dialog";
import { modeStore } from "@/lib/mode";
import { appear } from "@/lib/appear";
import { resolveIconOrNull } from "@/lib/icons";
import { isBirthdayToday, formatTurningAge } from "@/lib/birthday";
import { useTodayISO } from "@/components/tracking/clock";
import { useReminders } from "@/components/events/RemindersProvider";
import { QuickAdd } from "./QuickAdd";
import { ReminderRow } from "./ReminderRow";
import type { Reminder } from "@/db/queries/reminders";
import type { Person } from "@/db/queries/people";
import { tooltip } from "@/components/ui/Tooltip";

const CARD = "rounded-4xl bg-surface-1 p-7 shadow-sm";

function IconRow({ items, onAccent }: { items: Reminder[]; onAccent?: boolean }) {
  const icons = items
    .map((r) => ({ id: r.id, Icon: resolveIconOrNull(r.icon), color: r.color }))
    .filter((x) => x.Icon !== null);
  if (icons.length === 0) return null;
  return (
    <span className={`flex shrink-0 items-center gap-1.5 ${onAccent ? "opacity-50" : "opacity-70"}`}>
      {icons.slice(0, 6).map(({ id, Icon, color }) =>
        createElement(Icon!, {
          key: id,
          size: 15,
          strokeWidth: 1.75,
          color: onAccent ? undefined : (color ?? undefined),
        }),
      )}
    </span>
  );
}

function RoundArrow({ label, onAccent }: { label: string; onAccent?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      {...tooltip(label, "bottom")}
      onClick={() => modeStore.set("calendar")}
      className={`absolute right-6 top-6 grid h-11 w-11 cursor-pointer place-items-center rounded-full transition-[background-color,filter,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
        onAccent
          ? "bg-surface-0 text-app-text hover:brightness-125"
          : "bg-surface-2 text-app-text hover:bg-surface-3"
      }`}
    >
      <ArrowUpRight size={20} strokeWidth={2} />
    </button>
  );
}

function Card({
  title,
  empty,
  items,
  children,
}: {
  title: string;
  empty?: string;
  items?: Reminder[];
  children?: React.ReactNode;
}) {
  return (
    <section className={`relative flex h-full flex-col ${CARD}`}>
      <div className="mb-4 flex items-center">
        <h2 className="flex items-center gap-2.5 rounded-full bg-surface-2 py-1.5 pl-3.5 pr-3 text-xs font-medium tracking-wide text-muted">
          {title}
          <IconRow items={items ?? []} />
        </h2>
      </div>
      {children ?? <p className="text-sm text-muted opacity-60">{empty}</p>}
    </section>
  );
}

const MAX_ROWS = 4;

function Rows({
  items,
  dateLabelFor,
  completed = false,
  onAccent = false,
  limit,
  onMore,
  onToggle,
  onOpen,
  onMenu,
  onEventJump,
}: {
  items: Reminder[];
  dateLabelFor?: (r: Reminder) => string | undefined;
  completed?: boolean;
  onAccent?: boolean;
  limit?: number;
  onMore?: () => void;
  onToggle: (id: number) => void;
  onOpen?: (r: Reminder) => void;
  onMenu?: (r: Reminder, x: number, y: number) => void;
  onEventJump?: (eventId: number) => void;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  const hidden = items.length - shown.length;
  return (
    <>
    <ul className="flex flex-col gap-0.5">
      <AnimatePresence initial={false}>
        {shown.map((r) => (
          <ReminderRow
            key={r.id}
            reminder={r}
            dateLabel={dateLabelFor?.(r)}
            completed={completed}
            onAccent={onAccent}
            onToggle={onToggle}
            onOpen={onOpen}
            onMenu={onMenu}
            onEventJump={onEventJump}
          />
        ))}
      </AnimatePresence>
    </ul>
    {hidden > 0 && (
      <button
        type="button"
        onClick={onMore}
        className="mt-2 cursor-pointer self-start rounded-full bg-surface-2 px-4 py-1.5 text-xs text-muted transition-colors hover:bg-surface-3 hover:text-app-text"
      >
        Ещё {hidden}
      </button>
    )}
    </>
  );
}

type MoreGroup = "tomorrow" | "week" | "later";
const MORE_TITLE: Record<MoreGroup, string> = { tomorrow: "Завтра", week: "На неделе", later: "Позже" };

function groupByDate(items: Reminder[]) {
  const map = new Map<string, Reminder[]>();
  for (const r of items) {
    const key = effectiveDateISO(r);
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
}

function MoreDialog({
  group,
  items,
  today,
  onClose,
  onToggle,
  onOpen,
  onMenu,
  onEventJump,
}: {
  group: MoreGroup | null;
  items: Reminder[];
  today: string;
  onClose: () => void;
  onToggle: (id: number) => void;
  onOpen: (r: Reminder) => void;
  onMenu: (r: Reminder, x: number, y: number) => void;
  onEventJump?: (eventId: number) => void;
}) {
  const days = groupByDate(items);
  const showLabels = days.length >= 2;
  return (
    <Dialog
      open={group !== null && items.length > 0}
      onClose={onClose}
      width={520}
      title={
        group && (
          <>
            {MORE_TITLE[group]}{" "}
            <span className="font-light text-muted">{items.length}</span>
          </>
        )
      }
    >
      <div className="flex flex-col gap-1.5">
        {days.map(([iso, rows]) => (
          <div key={iso} className="flex flex-col">
            {showLabels && (
              <span className="mb-1 mt-1.5 inline-flex w-fit rounded-full bg-surface-2 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
                {formatRu(iso, iso.slice(0, 4) === today.slice(0, 4) ? "d MMMM, EEEEEE" : "d MMMM yyyy, EEEEEE")}
              </span>
            )}
            <Rows
              items={rows}
              onToggle={onToggle}
              onOpen={onOpen}
              onMenu={onMenu}
              onEventJump={onEventJump}
            />
          </div>
        ))}
      </div>
    </Dialog>
  );
}

export function RemindersView({
  reminders,
  people,
  onPersonClick,
  onEventJump,
}: {
  reminders: Reminder[];
  people: Person[];
  onPersonClick: (person: Person) => void;
  onEventJump?: (eventId: number) => void;
}) {
  const today = useTodayISO();
  const { finishReminder, purgeCompleted, postponeReminder, removeReminder, openEditReminder } =
    useReminders();
  const [showCompleted, setShowCompleted] = useState(false);
  const [menu, setMenu] = useState<{ reminder: Reminder; x: number; y: number } | null>(null);
  const [more, setMore] = useState<MoreGroup | null>(null);

  const onReminderOpen = openEditReminder;
  const openMenu = (reminder: Reminder, x: number, y: number) => setMenu({ reminder, x, y });

  const birthdays = useMemo(() => people.filter((p) => isBirthdayToday(p.birth_date)), [people]);

  const groups = useMemo(() => {
    const tomorrow = toISO(addDays(parseISO(today), 1));
    const weekEnd = toISO(addDays(parseISO(today), 7));
    const active = reminders.filter((r) => r.completed_at === null);
    const eff = effectiveDateISO;
    return {
      overdue: active.filter((r) => eff(r) < today),
      today: active.filter((r) => eff(r) === today),
      tomorrow: active.filter((r) => eff(r) === tomorrow),
      week: active.filter((r) => eff(r) > tomorrow && eff(r) <= weekEnd),
      later: active.filter((r) => eff(r) > weekEnd),
      completed: reminders
        .filter((r) => r.completed_at !== null)
        .sort((a, b) => (b.completed_at! < a.completed_at! ? -1 : 1)),
    };
  }, [reminders, today]);

  const empty =
    reminders.length === 0 && birthdays.length === 0;

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-6 px-6 py-10">
        <motion.div {...appear(0)}>
          <QuickAdd />
        </motion.div>

        {empty ? (
          <motion.div
            {...appear(1)}
            className="flex flex-col items-center gap-3 px-6 py-24 text-center text-muted"
          >
            <Bell size={40} strokeWidth={1.5} />
            <p className="max-w-sm">
              Пока ни одного напоминания. Добавьте первое в строке выше — с датой и, если нужно,
              временем.
            </p>
          </motion.div>
        ) : (
          <>
            {groups.overdue.length > 0 && (
              <motion.section
                {...appear(1)}
                className={CARD}
              >
                <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-rust">
                  Просроченные · {groups.overdue.length}
                </h2>
                <Rows
                  items={groups.overdue}
                  dateLabelFor={(r) => formatDayMonthRu(r.date)}
                  onToggle={finishReminder}
                  onOpen={onReminderOpen}
                  onMenu={openMenu} onEventJump={onEventJump}
                />
              </motion.section>
            )}

            <motion.div {...appear(2)} className="grid gap-6 lg:grid-cols-3">
              <section className="relative flex flex-col rounded-4xl bg-amber p-7 text-ink shadow-sm lg:col-span-3">
                <RoundArrow label="Открыть календарь" onAccent />
                <h2 className="max-w-[70%] text-[34px] leading-[1.1] tracking-tight">
                  <span className="font-light">Сегодня,</span>{" "}
                  <span className="font-bold">{formatRu(today, "d MMMM")}</span>
                </h2>
                <div className="mb-6 mt-1.5 flex items-center gap-3">
                  <p className="text-sm opacity-60">{formatWeekdayFullRu(today)}</p>
                  <IconRow items={groups.today} onAccent />
                </div>

                {birthdays.length > 0 && (
                  <ul className="mb-3 flex flex-col gap-0.5">
                    {birthdays.map((p) => {
                      const turning = formatTurningAge(p.birth_date, p.has_year);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => onPersonClick(p)}
                            className="flex w-full cursor-pointer items-center gap-3 rounded-full px-4 py-2.5 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--ds-on-accent)_10%,transparent)]"
                          >
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-amber">
                              <Cake size={14} strokeWidth={1.75} />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
                              День рождения — {p.name}
                            </span>
                            {turning && (
                              <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--ds-on-accent)_12%,transparent)] px-2.5 py-1 text-xs text-ink">
                                {turning}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {groups.today.length > 0 ? (
                  <Rows
                    items={groups.today}
                    onAccent
                    onToggle={finishReminder}
                    onOpen={onReminderOpen}
                    onMenu={openMenu} onEventJump={onEventJump}
                  />
                ) : (
                  birthdays.length === 0 && (
                    <p className="text-sm text-ink opacity-60">На сегодня напоминаний нет.</p>
                  )
                )}
              </section>

              <Card
                items={groups.tomorrow}
                title="Завтра"
                empty={groups.tomorrow.length === 0 ? "Ничего не запланировано" : undefined}
              >
                {groups.tomorrow.length > 0 ? (
                  <Rows
                    items={groups.tomorrow}
                    limit={MAX_ROWS}
                    onMore={() => setMore("tomorrow")}
                    onToggle={finishReminder}
                    onOpen={onReminderOpen}
                    onMenu={openMenu}
                    onEventJump={onEventJump}
                  />
                ) : undefined}
              </Card>

              <Card
                items={groups.week}
                title="На неделе"
                empty={groups.week.length === 0 ? "Неделя свободна" : undefined}
              >
                {groups.week.length > 0 ? (
                  <Rows
                    items={groups.week}
                    limit={MAX_ROWS}
                    onMore={() => setMore("week")}
                    dateLabelFor={(r) => formatWeekdayShortRu(effectiveDateISO(r))}
                    onToggle={finishReminder}
                    onOpen={onReminderOpen}
                    onMenu={openMenu}
                    onEventJump={onEventJump}
                  />
                ) : undefined}
              </Card>

              <Card items={groups.later} title="Позже" empty={groups.later.length === 0 ? "Пусто" : undefined}>
                {groups.later.length > 0 ? (
                  <Rows
                    items={groups.later}
                    limit={MAX_ROWS}
                    onMore={() => setMore("later")}
                    dateLabelFor={(r) => formatDayMonthRu(effectiveDateISO(r))}
                    onToggle={finishReminder}
                    onOpen={onReminderOpen}
                    onMenu={openMenu}
                    onEventJump={onEventJump}
                  />
                ) : undefined}
              </Card>
            </motion.div>

            {groups.completed.length > 0 && (
              <motion.section
                {...appear(3)}
                className={`rounded-4xl bg-surface-1 shadow-sm transition-[padding] duration-300 ease-[var(--rg-ease)] ${
                  showCompleted ? "px-8 py-7" : "px-6 py-3.5"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCompleted((v) => !v)}
                    className="flex cursor-pointer items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-muted transition-colors hover:text-app-text"
                  >
                    <ChevronRight
                      size={15}
                      strokeWidth={1.75}
                      className={`transition-transform duration-150 ease-[var(--rg-ease)] ${
                        showCompleted ? "rotate-90" : ""
                      }`}
                    />
                    Выполненные · {groups.completed.length}
                  </button>
                  <button
                    type="button"
                    onClick={() => purgeCompleted()}
                    className="cursor-pointer rounded-full bg-surface-2 px-4 py-1.5 text-xs text-muted transition-colors hover:bg-surface-3 hover:text-rust"
                  >
                    Очистить
                  </button>
                </div>
                {showCompleted && (
                  <div className="mt-5">
                    <Rows
                      items={groups.completed}
                      dateLabelFor={(r) => formatDayMonthRu(r.date)}
                      completed
                      onToggle={() => {}}
                      onOpen={onReminderOpen}
                    />
                  </div>
                )}
              </motion.section>
            )}
          </>
        )}
      </div>

      <MoreDialog
        group={more}
        items={more ? groups[more] : []}
        today={today}
        onClose={() => setMore(null)}
        onToggle={finishReminder}
        onOpen={(r) => {
          setMore(null);
          setTimeout(() => onReminderOpen(r), 120);
        }}
        onMenu={openMenu}
        onEventJump={onEventJump}
      />

      <ContextMenu
        open={menu !== null}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        onClose={() => setMenu(null)}
        items={
          menu
            ? [
                {
                  label: "Отложить на час",
                  icon: <AlarmClock size={15} strokeWidth={1.75} />,
                  onSelect: () => postponeReminder(menu.reminder.id, snoozePlusHour()),
                },
                {
                  label: "Отложить до вечера",
                  icon: <Sunset size={15} strokeWidth={1.75} />,
                  onSelect: () => postponeReminder(menu.reminder.id, snoozeEvening()),
                },
                {
                  label: "Отложить до завтра",
                  icon: <Moon size={15} strokeWidth={1.75} />,
                  onSelect: () => postponeReminder(menu.reminder.id, snoozeTomorrow()),
                },
                {
                  label: "Удалить",
                  icon: <Trash2 size={15} strokeWidth={1.75} />,
                  danger: true,
                  onSelect: () => removeReminder(menu.reminder.id),
                },
              ]
            : []
        }
      />
    </div>
  );
}
