import { useEffect } from "react";
import { prefetchQuery } from "./useQuery";
import { listAllEvents, loadCalendar, loadTimeline } from "@/db/queries/loaders";
import { listPeople } from "@/db/queries/people";

async function warm() {
  await Promise.all([
    prefetchQuery(listAllEvents),
    prefetchQuery(loadTimeline),
    prefetchQuery(loadCalendar),
    prefetchQuery(listPeople),
  ]);
}

export function usePrefetchPages() {
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void warm();
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 1500 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    const id = setTimeout(run, 1500);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);
}
