import { useEffect } from "react";
import { prefetchQuery } from "./useQuery";
import { listAllEvents, loadCalendar, loadTimeline } from "@/db/queries/loaders";
import { listPeople } from "@/db/queries/people";
import { listReminders } from "@/db/queries/reminders";
import { listBans, listSaved } from "@/db/queries/digestReactions";
import { listDigests, listEntries } from "@/db/queries/digests";
import { entriesKey, loadStatus } from "@/components/digest/DigestProvider";

async function warm() {
  await Promise.all([
    prefetchQuery(listAllEvents),
    prefetchQuery(loadTimeline),
    prefetchQuery(loadCalendar),
    prefetchQuery(listPeople),
    prefetchQuery(listReminders),
    prefetchQuery(listBans),
    prefetchQuery(listSaved),
    prefetchQuery(loadStatus),
  ]);
  const digests = await prefetchQuery(listDigests);
  const first = digests?.[0];
  if (first) await prefetchQuery(() => listEntries(first.id), { key: entriesKey(first.id) });
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
