import { TimelineStage } from "@/components/timeline/TimelineStage";
import { loadTimeline } from "@/db/queries/loaders";
import { useQuery } from "@/lib/useQuery";
import { useEvents } from "@/components/events/EventsProvider";
import { filterStore } from "@/lib/search";

export function TimelinePage() {
  const { openView, openDay, openCreate, openMarkMenu } = useEvents();
  const filter = filterStore.use();
  const { data, error } = useQuery(loadTimeline);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-rust">
        Не удалось открыть базу данных: {error}
      </div>
    );
  }
  if (!data) return null;

  return (
    <TimelineStage
      events={data.events}
      marks={data.marks}
      filter={filter}
      onFilterChange={filterStore.set}
      onCreateAt={openCreate}
      onEventOpen={openView}
      onMarkOpen={openDay}
      onMarkMenu={openMarkMenu}
    />
  );
}
