import { useEffect, useRef, useState, type RefObject } from "react";

export type ScrubGroup = { key: string; label: string };

function activeLabelAt(el: HTMLElement, groups: ScrubGroup[]): string {
  const contTop = el.getBoundingClientRect().top;
  const sections = el.querySelectorAll<HTMLElement>("[data-scrubber-key]");
  let label = groups[0]?.label ?? "";
  for (const s of sections) {
    const rel = s.getBoundingClientRect().top - contTop;
    if (rel <= 80) {
      label = groups.find((g) => g.key === s.dataset.scrubberKey)?.label ?? label;
    } else {
      break;
    }
  }
  return label;
}

export function DateScrubber({
  scrollRef,
  groups,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  groups: ScrubGroup[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [frac, setFrac] = useState(0);
  const [label, setLabel] = useState(() => groups[0]?.label ?? "");
  const [active, setActive] = useState(false);

  // Только подписка — thumb и подпись обновляются в обработчике scroll (не setState в эффекте).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = el.scrollHeight - el.clientHeight;
      setFrac(max > 0 ? el.scrollTop / max : 0);
      setLabel(activeLabelAt(el, groups));
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRef, groups]);

  const scrollToPointer = (clientY: number) => {
    const track = trackRef.current;
    const el = scrollRef.current;
    if (!track || !el) return;
    const r = track.getBoundingClientRect();
    const f = Math.min(Math.max((clientY - r.top) / r.height, 0), 1);
    el.scrollTop = f * (el.scrollHeight - el.clientHeight);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    setActive(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    scrollToPointer(e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    scrollToPointer(e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setActive(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute bottom-24 right-2 top-24 z-20 w-8 cursor-ns-resize touch-none"
    >
      <div className="absolute bottom-0 left-1/2 top-0 w-0.5 -translate-x-1/2 rounded-full bg-surface-2 opacity-60" />
      <div
        className={`absolute left-1/2 h-12 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors ${
          active ? "bg-amber" : "bg-muted"
        }`}
        style={{ top: `${frac * 100}%` }}
      />
      {active && label && (
        <div
          className="pointer-events-none absolute right-8 -translate-y-1/2 whitespace-nowrap rounded-2xl bg-surface-3 px-3.5 py-2 text-[13px] font-medium text-app-text"
          style={{ top: `${frac * 100}%`, boxShadow: "var(--ds-shadow-2)" }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
