import { formatDayMonthRu, formatWeekdayFullRu } from "@/lib/dates";
import {
  DAYS,
  anniversaryAhead,
  formatTotalDays,
  isFuture,
  pluralRu,
  totalDaysCount,
  unit,
} from "@/lib/duration";
import { GlassIcon, type GlassIconName } from "@/components/ui/GlassIcon";

export function SpanHero({
  label,
  days,
  subs,
  onAccent,
}: {
  label: string;
  days: number | null;
  subs: string[];
  onAccent?: boolean;
}) {
  const subTone = onAccent ? "opacity-65" : "text-muted";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className={`text-[12.5px] font-medium ${subTone}`}>{label}</span>
      {days === null ? (
        <span className="text-[64px] leading-[0.9] font-bold tracking-[-0.04em]">Сегодня</span>
      ) : (
        <span className="flex items-baseline">
          <span className="text-[64px] leading-[0.9] font-bold tracking-[-0.04em] tabular-nums">
            {days.toLocaleString("ru-RU")}
          </span>
          <span className="ml-2 text-[28px] font-light tracking-[-0.02em]">{pluralRu(days, DAYS)}</span>
        </span>
      )}
      {subs.map((s) => (
        <span key={s} className={`text-sm font-medium tabular-nums ${subTone}`}>
          {s}
        </span>
      ))}
    </div>
  );
}

const TILE_BG =
  "radial-gradient(130px circle at 26px 50%, color-mix(in srgb, var(--ds-accent) 20%, transparent), transparent 70%), var(--ds-surface-2)";
const TILE_BG_ACCENT =
  "radial-gradient(130px circle at 26px 50%, rgb(255 255 255 / 34%), transparent 70%), color-mix(in srgb, var(--ds-on-accent) 10%, transparent)";
const BAR_BG_ACCENT = "color-mix(in srgb, var(--ds-on-accent) 10%, transparent)";

const yearsGen = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "года" : "лет");

function barOf(dateISO: string) {
  const total = totalDaysCount(dateISO);
  if (isFuture(dateISO)) {
    return {
      title: "До события",
      value: unit(total, DAYS),
      pct: Math.min(100, Math.max(4, Math.round((1 - total / 30) * 100))),
    };
  }
  const a = anniversaryAhead(dateISO);
  if (!a) return null;
  return {
    title: `До ${a.ordinal} ${yearsGen(a.ordinal)}`,
    value: a.daysUntil === 0 ? "сегодня" : unit(a.daysUntil, DAYS),
    pct: Math.min(100, Math.max(0, Math.round(((365 - a.daysUntil) / 365) * 100))),
  };
}

export function TrackingTiles({ dateISO, onAccent }: { dateISO: string; onAccent?: boolean }) {
  const bar = barOf(dateISO);
  const subTone = onAccent ? "opacity-65" : "text-muted";
  const tiles: { icon: GlassIconName; value: string; label: string }[] = [
    {
      icon: "hourglass",
      value: isFuture(dateISO) ? unit(totalDaysCount(dateISO), DAYS) : formatTotalDays(dateISO),
      label: "всего",
    },
    { icon: "week", value: formatDayMonthRu(dateISO), label: formatWeekdayFullRu(dateISO) },
  ];

  return (
    <div className="flex flex-col gap-2">
      {bar && (
        <div
          className="flex flex-col gap-2 rounded-3xl px-4 py-3.5"
          style={{ background: onAccent ? BAR_BG_ACCENT : "var(--ds-surface-2)" }}
        >
          <div className="flex items-baseline justify-between gap-3 text-[13px] font-semibold">
            <span className="truncate">{bar.title}</span>
            <span className={`shrink-0 font-medium ${subTone}`}>{bar.value}</span>
          </div>
          <div
            className="relative h-2 overflow-hidden rounded-full"
            style={{ background: "color-mix(in srgb, currentColor 10%, transparent)" }}
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${bar.pct}%`, background: onAccent ? "var(--ds-on-accent)" : "var(--ds-accent-ink)" }}
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t, i) => (
          <div
            key={t.icon}
            className="flex min-w-0 items-center gap-2.5 rounded-3xl py-2 pl-2 pr-3.5"
            style={{ background: onAccent ? TILE_BG_ACCENT : TILE_BG }}
          >
            <GlassIcon name={t.icon} size={32} className="glass-float" delay={-i * 1.4} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] font-bold tabular-nums">{t.value}</span>
              <span className={`truncate text-xs font-medium ${subTone}`}>{t.label}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
