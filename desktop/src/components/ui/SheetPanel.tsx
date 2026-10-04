import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { useSheetOverlay } from "./SideSheet";

export function SheetLayer({
  open,
  onExitComplete,
  children,
}: {
  open: boolean;
  onExitComplete?: () => void;
  children: ReactNode;
}) {
  const overlay = useSheetOverlay();
  if (!overlay) return null;
  return createPortal(<AnimatePresence onExitComplete={onExitComplete}>{open && children}</AnimatePresence>, overlay);
}

export function SheetPanel({
  title,
  label,
  onBack,
  children,
}: {
  title: ReactNode;
  label: string;
  onBack: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const backRef = useRef(onBack);
  const present = useIsPresent();
  const presentRef = useRef(present);

  useEffect(() => {
    backRef.current = onBack;
    presentRef.current = present;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !presentRef.current) return;
      e.stopPropagation();
      backRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    const host = ref.current?.parentElement;
    const behind = [...(host?.parentElement?.children ?? [])].filter((el) => el !== host) as HTMLElement[];
    behind.forEach((el) => (el.inert = true));
    return () => behind.forEach((el) => (el.inert = false));
  }, []);

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="pointer-events-auto absolute inset-0 flex flex-col bg-surface-1"
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 28 }}
      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
    >
      <header className="flex shrink-0 items-center gap-3 px-7 pb-3 pt-6">
        <button
          type="button"
          aria-label="Назад"
          onClick={onBack}
          className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-2 text-app-text transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 active:scale-[0.96]"
        >
          <ChevronLeft size={20} strokeWidth={1.75} />
        </button>
        <h2 className="truncate text-xl font-bold tracking-tight text-app-text">{title}</h2>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-7 pb-7 [scrollbar-gutter:stable]">
        {children}
      </div>
    </motion.div>
  );
}
