import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useBack } from "@/lib/back";
import { nudge } from "@/lib/nudge";

export const SHEET_WIDTH = 430;

let openSheets = 0;
const sheetListeners = new Set<() => void>();
const emitSheets = () => sheetListeners.forEach((l) => l());
const subscribeSheets = (l: () => void) => {
  sheetListeners.add(l);
  return () => sheetListeners.delete(l);
};

export function useAnySheetOpen() {
  return useSyncExternalStore(subscribeSheets, () => openSheets > 0);
}

const HeaderSlotContext = createContext<HTMLElement | null>(null);
const OverlayContext = createContext<HTMLElement | null>(null);
const GuardContext = createContext<((dirty: boolean) => void) | null>(null);

export function useSheetOverlay() {
  return useContext(OverlayContext);
}

export function useSheetGuard(dirty: boolean) {
  const setDirty = useContext(GuardContext);
  useEffect(() => {
    setDirty?.(dirty);
    return () => setDirty?.(false);
  }, [setDirty, dirty]);
}

export function SheetHeaderAction({ children }: { children: ReactNode }) {
  const slot = useContext(HeaderSlotContext);
  return slot ? createPortal(children, slot) : null;
}

export function SideSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const panel = useRef<HTMLElement>(null);
  const dirty = useRef(false);
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const onDismiss = useCallback(() => (dirty.current ? nudge(panel.current) : onClose()), [onClose]);
  useBack(open, onDismiss);

  useEffect(() => {
    if (!open) return;
    openSheets += 1;
    emitSheets();
    return () => {
      openSheets -= 1;
      emitSheets();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[80]"
            style={{ background: "var(--rg-scrim)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onMouseDown={onDismiss}
          />
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            className="fixed right-0 top-0 z-[81] flex h-screen flex-col rounded-l-4xl bg-surface-1 text-app-text shadow-2xl"
            style={{ width: SHEET_WIDTH }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 px-7 pb-3 pt-6">
              <h2 className="text-xl font-bold tracking-tight text-app-text">{title}</h2>
              <div ref={setSlot} className="ml-auto flex items-center gap-2" />
              <button
                type="button"
                aria-label="Закрыть"
                onClick={onClose}
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-2 text-app-text transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 active:scale-[0.96]"
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 [scrollbar-gutter:stable]">
              <HeaderSlotContext.Provider value={slot}>
                <OverlayContext.Provider value={overlay}>
                  <GuardContext.Provider value={setDirty}>{children}</GuardContext.Provider>
                </OverlayContext.Provider>
              </HeaderSlotContext.Provider>
            </div>
            <div ref={setOverlay} className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-l-4xl" />
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
