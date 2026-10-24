import { useEffect, useRef, useState } from "react";
import type { DigestEntry } from "@/db/queries/digests";

type Actions = {
  open: (entry: DigestEntry) => void;
  react: (entry: DigestEntry, value: 1 | -1) => void;
  seen: (entry: DigestEntry) => void;
  star: (entry: DigestEntry) => void;
  search: () => void;
};

export function useDigestKeys(order: DigestEntry[], actions: Actions) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const latest = useRef({ order, actions, selectedId });
  latest.current = { order, actions, selectedId };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const { order, actions, selectedId } = latest.current;
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyF") {
        e.preventDefault();
        actions.search();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      if (e.code === "Slash") {
        e.preventDefault();
        actions.search();
        return;
      }
      if (e.code === "Enter" && t?.tagName === "BUTTON") return;
      if (order.length === 0) return;
      const index = order.findIndex((x) => x.item_id === selectedId);
      const current = index === -1 ? null : order[index];

      if (e.code === "KeyJ" || e.code === "KeyK") {
        const step = e.code === "KeyJ" ? 1 : -1;
        const next = index === -1 ? (step === 1 ? 0 : order.length - 1) : Math.min(Math.max(index + step, 0), order.length - 1);
        setSelectedId(order[next].item_id);
      } else if (current && e.code === "Enter") actions.open(current);
      else if (current && e.code === "KeyL") actions.react(current, 1);
      else if (current && e.code === "KeyD") actions.react(current, -1);
      else if (current && e.code === "KeyM") actions.seen(current);
      else if (current && e.code === "KeyS") actions.star(current);
      else return;
      e.preventDefault();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    document.querySelector(`[data-digest-item="${selectedId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return selectedId;
}
