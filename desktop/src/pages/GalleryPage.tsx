import { GalleryView } from "@/components/gallery/GalleryView";
import { listAllEvents } from "@/db/queries/loaders";
import { useQuery } from "@/lib/useQuery";
import { useEvents } from "@/components/events/EventsProvider";
import { filterStore } from "@/lib/search";

export function GalleryPage() {
  const { openView } = useEvents();
  const filter = filterStore.use();
  const { data: events, error } = useQuery(listAllEvents);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-rust">
        Не удалось открыть базу данных: {error}
      </div>
    );
  }
  if (!events) return null;

  return (
    <GalleryView
      events={events}
      filter={filter}
      onFilterChange={filterStore.set}
      onEventClick={openView}
    />
  );
}
