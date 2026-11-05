import { modeStore, type ViewMode } from "@/lib/mode";
import { searchOpenStore } from "@/lib/search";
import { useAnySheetOpen } from "./SideSheet";

const CREATE_MODES = new Set<ViewMode>(["timeline", "gallery", "calendar", "tracking"]);

export const FAB_SIZE = 56;

export function useCornerFab(): "create" | "page" | null {
  const mode = modeStore.use();
  const sheetOpen = useAnySheetOpen();
  const searchOpen = searchOpenStore.use();
  if (sheetOpen || searchOpen) return null;
  if (CREATE_MODES.has(mode)) return "create";
  return mode === "birthdays" ? "page" : null;
}
