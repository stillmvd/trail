import { TrackingView } from "@/components/tracking/TrackingView";
import { listAllEvents } from "@/db/queries/loaders";
import { useQuery } from "@/lib/useQuery";
import { useEvents } from "@/components/events/EventsProvider";

export function TrackingPage() {
  const { openView } = useEvents();
  const { data: events, error } = useQuery(listAllEvents);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-rust">
        Не удалось открыть базу данных: {error}
      </div>
    );
  }
  if (!events) return null;

  return <TrackingView events={events} onEventClick={openView} />;
}
