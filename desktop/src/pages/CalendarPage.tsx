import { CalendarView } from "@/components/calendar/CalendarView";
import { loadCalendar } from "@/db/queries/loaders";
import { useQuery } from "@/lib/useQuery";
import { useEvents } from "@/components/events/EventsProvider";
import { usePeople } from "@/components/events/PeopleProvider";
import { filterStore } from "@/lib/search";

export function CalendarPage() {
  const { openView, openDay, openCreate, openMarkMenu } = useEvents();
  const { openViewPerson } = usePeople();
  const filter = filterStore.use();
  const { data, error } = useQuery(loadCalendar);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-rust">
        Не удалось открыть базу данных: {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <CalendarView
      events={data.events}
      marks={data.marks}
      people={data.people}
      filter={filter}
      onFilterChange={filterStore.set}
      onEventClick={openView}
      onDayOpen={openDay}
      onCreateRequest={openCreate}
      onMarkOpen={openDay}
      onMarkMenu={openMarkMenu}
      onPersonOpen={openViewPerson}
    />
  );
}
