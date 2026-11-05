import { createElement } from "react";
import { motion } from "motion/react";
import { CircleDot, Rows3 } from "lucide-react";
import { timelineLayerStore, type TimelineLayer } from "@/lib/timelineLayer";

const EASE = [0.2, 0, 0, 1] as const;
const PILL_SPRING = { type: "spring" as const, bounce: 0, duration: 0.4 };

const ITEMS: Array<{ value: TimelineLayer; label: string; icon: typeof CircleDot }> = [
  { value: "events", label: "События", icon: CircleDot },
  { value: "periods", label: "Периоды", icon: Rows3 },
];

export function LayerToggle() {
  const layer = timelineLayerStore.use();

  return (
    <div
      className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 gap-1 rounded-full bg-surface-2 p-1.5"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      {ITEMS.map(({ value, label, icon }) => {
        const active = value === layer;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => timelineLayerStore.set(value)}
            className={`relative flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
              active ? "text-accent-ink" : "text-muted hover:text-app-text"
            }`}
          >
            {active && (
              <motion.span
                layoutId="tl-layer-pill"
                className="absolute inset-0 rounded-full bg-surface-3"
                transition={PILL_SPRING}
              />
            )}
            <motion.span
              className="relative flex"
              animate={active ? { scale: [1, 1.22, 1], rotate: [0, -10, 0] } : { scale: 1, rotate: 0 }}
              transition={{ duration: 0.42, ease: EASE }}
            >
              {createElement(icon, { size: 14, strokeWidth: 1.75 })}
            </motion.span>
            <span className="relative">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
