import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useBack } from "@/lib/back";

export function Dialog({
  open,
  onClose,
  title,
  width = 460,
  zIndex = 90,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  width?: number;
  zIndex?: number;
  children: ReactNode;
}) {
  useBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 grid place-items-center p-6"
          style={{ zIndex, background: "var(--rg-scrim)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onMouseDown={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-4xl bg-surface-1 text-app-text shadow-2xl"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {title && (
              <header className="flex shrink-0 items-center justify-between gap-3 px-7 pb-3 pt-6">
                <h2 className="text-xl font-bold tracking-tight text-app-text">{title}</h2>
                <button
                  type="button"
                  aria-label="Закрыть"
                  onClick={onClose}
                  className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-2 text-app-text transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 active:scale-[0.96]"
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </header>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
