import { useEffect } from "react";
import { SearchPanel } from "./SearchPanel";
import { FilterIndicator } from "./FilterIndicator";
import { filterStore, searchOpenStore } from "@/lib/search";
import { EMPTY_FILTER } from "@/lib/filter";
import { modeStore } from "@/lib/mode";
import { useEvents } from "@/components/events/EventsProvider";
import { useQuery } from "@/lib/useQuery";
import type { TimelineEvent } from "@/db/queries/events";
import { listAllEvents } from "@/db/queries/loaders";
import { listCategories } from "@/db/queries/categories";

export function SearchHost() {
  const open = searchOpenStore.use();
  const filter = filterStore.use();
  const { openView } = useEvents();
  const { data: events } = useQuery(listAllEvents);
  const { data: categories } = useQuery(listCategories);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (modeStore.get() === "digest") return;
      const t = e.target as HTMLElement | null;
      const editable =
        t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyF") {
        e.preventDefault();
        searchOpenStore.set(true);
      } else if (e.code === "Slash" && !editable && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchOpenStore.set(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleSelect = (event: TimelineEvent) => {
    searchOpenStore.set(false);
    openView(event);
  };

  return (
    <>
      <FilterIndicator
        filter={filter}
        onOpen={() => searchOpenStore.set(true)}
        onClear={() => filterStore.set(EMPTY_FILTER)}
      />
      <SearchPanel
        open={open}
        filter={filter}
        categories={categories ?? []}
        events={events ?? []}
        onFilterChange={filterStore.set}
        onSelectResult={handleSelect}
        onClose={() => searchOpenStore.set(false)}
      />
    </>
  );
}
