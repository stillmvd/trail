import { formatDayMonthRu, formatWeekdayFullRu } from "@/lib/dates";
import { DAYS, MONTHS, YEARS, pluralRu, unit } from "@/lib/duration";
import { currentAgeParts, daysUntilBirthday, nextBirthdayISO, turningAge } from "@/lib/birthday";
import { GlassIcon, type GlassIconName } from "@/components/ui/GlassIcon";
import type { Person } from "@/db/queries/people";

const SUB = "text-sm font-medium";

export function AgeHero({ person, onAccent }: { person: Person; onAccent?: boolean }) {
  const today = daysUntilBirthday(person.birth_date) === 0;
  const age = currentAgeParts(person.birth_date, person.has_year);
  const subTone = onAccent ? "opacity-65" : "text-muted";

  let n: number;
  let forms = DAYS;
  let sub = "";
  if (!age) {
    n = daysUntilBirthday(person.birth_date);
  } else if (age.years) {
    n = age.years;
    forms = YEARS;
    sub = [age.months && unit(age.months, MONTHS), age.days && unit(age.days, DAYS)].filter(Boolean).join(" ");
  } else if (age.months) {
    n = age.months;
    forms = MONTHS;
    sub = age.days ? unit(age.days, DAYS) : "";
  } else {
    n = age.days;
  }
  if (today) sub = "сегодня день рождения";

  if (!age && today) {
    return <span className="text-[64px] leading-[0.9] font-bold tracking-[-0.04em]">Сегодня</span>;
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {!age && <span className={`text-[12.5px] font-medium ${subTone}`}>до дня рождения</span>}
      <span className="flex items-baseline">
        <span className="text-[64px] leading-[0.9] font-bold tracking-[-0.04em] tabular-nums">{n}</span>
        <span className="ml-2 text-[28px] font-light tracking-[-0.02em]">{pluralRu(n, forms)}</span>
      </span>
      {sub && <span className={`${SUB} ${subTone}`}>{sub}</span>}
    </div>
  );
}

const TILE_BG = "radial-gradient(130px circle at 32px 32px, color-mix(in srgb, var(--ds-accent) 20%, transparent), transparent 70%), var(--ds-surface-2)";
const TILE_BG_ACCENT =
  "radial-gradient(130px circle at 32px 32px, rgb(255 255 255 / 34%), transparent 70%), color-mix(in srgb, var(--ds-on-accent) 10%, transparent)";

export function BirthdayTiles({ person, onAccent }: { person: Person; onAccent?: boolean }) {
  const days = daysUntilBirthday(person.birth_date);
  const nb = nextBirthdayISO(person.birth_date);
  const turning = turningAge(person.birth_date, person.has_year);
  const tiles: { icon: GlassIconName; value: string; label: string }[] = [
    { icon: "gift", value: days === 0 ? "Сегодня" : unit(days, DAYS), label: "до праздника" },
    ...(turning !== null ? [{ icon: "cake" as const, value: unit(turning, YEARS), label: "исполнится" }] : []),
    { icon: "calendar", value: formatDayMonthRu(nb), label: formatWeekdayFullRu(nb) },
  ];

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
      {tiles.map((t, i) => (
        <div
          key={t.icon}
          className="flex min-w-0 flex-col items-start gap-0.5 rounded-3xl p-3"
          style={{ background: onAccent ? TILE_BG_ACCENT : TILE_BG }}
        >
          <GlassIcon name={t.icon} size={40} className="glass-float mb-2" delay={-i * 1.05} />
          <span className="max-w-full truncate text-base font-bold tracking-[-0.01em] tabular-nums">{t.value}</span>
          <span className={`max-w-full truncate text-xs font-medium ${onAccent ? "opacity-65" : "text-muted"}`}>
            {t.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PersonPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-2">
      <GlassIcon name="person" size={72} />
    </div>
  );
}
