import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { CATEGORY_COLORS, onColorFor } from "@/lib/colors";

export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      <div className="grid grid-cols-8 gap-2.5">
        {CATEGORY_COLORS.map((color) => {
          const active = color.toLowerCase() === value.toLowerCase();
          return (
            <motion.button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={active}
              onClick={() => onChange(color)}
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rg-text)]"
              style={{ background: color, zIndex: active ? 1 : undefined }}
              initial={false}
              animate={{ scale: active ? 1.22 : 1 }}
              whileHover={{ scale: active ? 1.22 : 1.1 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", duration: 0.35, bounce: 0.3 }}
            >
              <AnimatePresence initial={false}>
                {active && (
                  <motion.span
                    className="grid place-items-center"
                    initial={{ scale: 0, rotate: -60, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                  >
                    <Check size={16} strokeWidth={3} style={{ color: onColorFor(color) }} />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
