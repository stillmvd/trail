import { useMemo } from "react";
import { Cake, Plus } from "lucide-react";
import { BirthdayCard } from "./BirthdayCard";
import { Button } from "@/components/ui/Button";
import { useTodayISO } from "@/components/tracking/clock";
import { daysUntilBirthday } from "@/lib/birthday";
import type { Person } from "@/db/queries/people";

function Section({
  title,
  people,
  showHeader,
  accentFirst,
  onPersonClick,
}: {
  title: string;
  people: Person[];
  showHeader: boolean;
  accentFirst?: boolean;
  onPersonClick: (person: Person) => void;
}) {
  return (
    <section>
      {showHeader && (
        <div className="sticky top-0 z-30 mb-4 flex justify-center">
          <h2
            className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted backdrop-blur"
            style={{ boxShadow: "var(--ds-shadow-1)" }}
          >
            {title}
            <span
              className="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium text-app-text"
              style={{ background: "var(--ds-surface-3)" }}
            >
              {people.length}
            </span>
          </h2>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(364px,1fr))] gap-5">
        {people.map((person, i) => (
          <BirthdayCard
            key={person.id}
            person={person}
            highlight={accentFirst && i === 0}
            onClick={onPersonClick}
          />
        ))}
      </div>
    </section>
  );
}

export function BirthdaysView({
  people,
  onPersonClick,
  onAdd,
}: {
  people: Person[];
  onPersonClick: (person: Person) => void;
  onAdd: () => void;
}) {
  // Реактивный «сегодня»: в полночь именинник сам уезжает из «Сегодня» в «Ближайшие».
  useTodayISO();
  const { today, upcoming } = useMemo(() => {
    const sorted = [...people].sort(
      (a, b) =>
        daysUntilBirthday(a.birth_date) - daysUntilBirthday(b.birth_date) || a.id - b.id,
    );
    return {
      today: sorted.filter((p) => daysUntilBirthday(p.birth_date) === 0),
      upcoming: sorted.filter((p) => daysUntilBirthday(p.birth_date) !== 0),
    };
  }, [people]);

  if (people.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-6 text-center">
        <span
          className="grid h-20 w-20 place-items-center rounded-full"
          style={{ background: "var(--ds-surface-2)", color: "var(--ds-accent-ink)" }}
        >
          <Cake size={36} strokeWidth={1.5} />
        </span>
        <p className="max-w-sm text-[15px] leading-relaxed text-muted">
          Пока никого нет. Добавьте близких людей — и здесь появятся их дни рождения с отсчётом и
          возрастом.
        </p>
        <Button onClick={onAdd}>
          <Plus size={16} strokeWidth={1.75} />
          Добавить человека
        </Button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <button
        type="button"
        onClick={onAdd}
        aria-label="Добавить человека"
        className="absolute bottom-6 right-6 z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-amber text-ink shadow-lg transition-transform hover:scale-105 active:scale-[0.96]"
      >
        <Plus size={24} strokeWidth={1.75} />
      </button>
      <div className="h-full w-full overflow-y-auto px-6 py-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-12">
          {today.length > 0 && (
            <Section
              title="Сегодня"
              people={today}
              showHeader={upcoming.length > 0}
              accentFirst
              onPersonClick={onPersonClick}
            />
          )}
          {upcoming.length > 0 && (
            <Section
              title="Ближайшие дни рождения"
              people={upcoming}
              showHeader={today.length > 0}
              accentFirst={today.length === 0}
              onPersonClick={onPersonClick}
            />
          )}
        </div>
      </div>
    </div>
  );
}
