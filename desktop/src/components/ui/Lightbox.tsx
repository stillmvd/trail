import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useBack } from "@/lib/back";

export function Lightbox({
  open,
  images,
  index,
  onIndexChange,
  onClose,
}: {
  open: boolean;
  images: { key: string; src: string }[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const count = images.length;

  useBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && count > 1) onIndexChange((index - 1 + count) % count);
      else if (e.key === "ArrowRight" && count > 1) onIndexChange((index + 1) % count);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, index, count, onIndexChange, onClose]);

  const img = images[index];

  return createPortal(
    <AnimatePresence>
      {open && img && (
        <motion.div
          className="fixed inset-0 z-[110] grid place-items-center p-10"
          style={{ background: "var(--rg-scrim-strong)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={onClose}
        >
          <button
            type="button"
            aria-label="Закрыть"
            onClick={onClose}
            className="absolute right-5 top-5 grid h-12 w-12 cursor-pointer place-items-center rounded-full bg-black/50 text-white transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-black/70 active:scale-[0.96]"
          >
            <X size={22} />
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Назад"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onIndexChange((index - 1 + count) % count)}
                className="absolute left-5 grid h-12 w-12 cursor-pointer place-items-center rounded-full bg-black/50 text-white transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-black/70 active:scale-[0.96]"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                aria-label="Вперёд"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => onIndexChange((index + 1) % count)}
                className="absolute right-5 top-1/2 grid h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          <motion.img
            key={img.key}
            src={img.src}
            alt=""
            className="max-h-full max-w-full rounded-4xl object-contain shadow-2xl"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
