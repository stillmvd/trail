import { useEffect, useState, type RefObject } from "react";
import { Plus, Minus, CalendarClock } from "lucide-react";
import { type Viewport, xToMs } from "@/lib/projection";
import { msToISO, formatFullRu } from "@/lib/dates";
import type { Lod } from "./lod";

const LOD_LABEL: Record<Lod, string> = {
  years: "Годы",
  months: "Месяцы",
  days: "Дни",
};

type Props = {
  viewport: Viewport;
  lod: Lod;
  containerRef: RefObject<HTMLDivElement | null>;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToday: () => void;
};

const BTN =
  "grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-surface-2 text-app-text transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 active:scale-[0.96]";

export function TimelineControls({
  viewport,
  lod,
  containerRef,
  onZoomIn,
  onZoomOut,
  onToday,
}: Props) {
  const [cursorX, setCursorX] = useState<number | null>(null);

  // Слежение за курсором для индикатора даты — локальный state, чтобы не дёргать canvas.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      setCursorX(e.clientX - rect.left);
    };
    const onLeave = () => setCursorX(null);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [containerRef]);

  const dateLabel = cursorX !== null ? formatFullRu(msToISO(xToMs(cursorX, viewport))) : null;

  return (
    <>
      <div className="pointer-events-none absolute bottom-6 left-6 z-30 flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-xs">
        <span className="font-semibold text-app-text">{LOD_LABEL[lod]}</span>
        {dateLabel && <span className="text-muted">{dateLabel}</span>}
      </div>
      <div
        className="absolute bottom-6 right-24 z-30 flex items-center gap-2"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Отдалить" className={BTN} onClick={onZoomOut}>
          <Minus size={18} strokeWidth={1.75} />
        </button>
        <button type="button" aria-label="Приблизить" className={BTN} onClick={onZoomIn}>
          <Plus size={18} strokeWidth={1.75} />
        </button>
        <button type="button" aria-label="К сегодня" className={BTN} onClick={onToday}>
          <CalendarClock size={18} strokeWidth={1.75} />
        </button>
      </div>
    </>
  );
}
