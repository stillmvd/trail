import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { useEvents } from "@/components/events/EventsProvider";
import { tooltip } from "@/components/ui/Tooltip";
import { useCornerFab } from "@/components/ui/cornerFab";
import { todayISO } from "@/lib/dates";

export function CreateFab() {
  const { openCreate } = useEvents();
  const shown = useCornerFab() === "create";

  return (
    <AnimatePresence>
      {shown && (
        <motion.button
          key="create-fab"
          type="button"
          aria-label="Новое событие"
          aria-keyshortcuts="N"
          {...tooltip("Новое событие · N", "left")}
          onClick={() => openCreate(todayISO())}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", duration: 0.25, bounce: 0 }}
          className="fixed bottom-6 right-6 z-[70] grid h-14 w-14 cursor-pointer place-items-center rounded-full bg-amber text-ink shadow-lg transition-[scale] duration-150 ease-[var(--rg-ease)] hover:scale-105 active:scale-[0.96]"
        >
          <Plus size={24} strokeWidth={1.75} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
