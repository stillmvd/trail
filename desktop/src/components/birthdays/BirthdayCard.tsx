import { ArrowUpRight } from "lucide-react";
import { formatFullRu, formatDayMonthRu } from "@/lib/dates";
import type { Person } from "@/db/queries/people";
import { AgeHero, BirthdayTiles, PersonPlaceholder } from "./BirthdayParts";
import { MediaImg } from "@/components/ui/MediaImg";

const ELEVATION_1 = "var(--ds-shadow-1)";
const ELEVATION_2 = "var(--ds-shadow-2)";

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function BirthdayCard({
  person,
  highlight,
  onClick,
}: {
  person: Person;
  highlight?: boolean;
  onClick: (person: Person) => void;
}) {
  const ground = highlight ? "var(--ds-accent)" : "var(--ds-surface-1)";

  return (
    <button
      type="button"
      onClick={() => onClick(person)}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-4xl text-left transition-[box-shadow,scale] duration-200 ease-[var(--rg-ease)] active:scale-[0.96] ${
        highlight ? "bg-amber text-ink" : "bg-surface-1 text-app-text"
      }`}
      style={{ boxShadow: ELEVATION_1 }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = ELEVATION_2)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = ELEVATION_1)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 bg-app-text opacity-0 transition-opacity duration-200 group-hover:opacity-[0.06]"
      />

      <div className="relative aspect-[4/3.4] w-full overflow-hidden">
        {person.photo ? (
          <MediaImg path={person.photo} className="h-full w-full object-cover" />
        ) : (
          <PersonPlaceholder />
        )}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, transparent 38%, color-mix(in srgb, ${ground} 70%, transparent) 70%, ${ground} 100%)`,
          }}
        />

        <span
          aria-hidden
          className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] group-hover:scale-105"
          style={{
            background: highlight ? "var(--ds-on-accent)" : "var(--rg-bg)",
            color: highlight ? "var(--rg-amber)" : "var(--rg-text)",
          }}
        >
          <ArrowUpRight size={18} strokeWidth={2} />
        </span>

        <div className="absolute inset-x-5 bottom-4 z-[1] flex flex-col gap-2.5">
          <div className="min-w-0">
            <h3 className="truncate text-2xl font-bold tracking-tight">{person.name}</h3>
            <p
              className={`mt-0.5 text-sm font-medium ${highlight ? "opacity-75" : ""}`}
              style={
                highlight
                  ? undefined
                  : {
                      color: "color-mix(in srgb, var(--rg-text) 80%, transparent)",
                      textShadow: "0 1px 10px color-mix(in srgb, var(--rg-bg) 75%, transparent)",
                    }
              }
            >
              {person.has_year ? formatFullRu(person.birth_date) : cap(formatDayMonthRu(person.birth_date))}
            </p>
          </div>
          <AgeHero person={person} onAccent={highlight} />
        </div>
      </div>

      <div className="px-5 pb-5 pt-1">
        <BirthdayTiles person={person} onAccent={highlight} />
      </div>
    </button>
  );
}
