import { createLocalStore } from "./localStore";
import { modeStore, type ViewMode } from "./mode";

export type SettingsSection = "general" | "refs" | "images" | "data";

export const settingsSectionStore = createLocalStore<SettingsSection>("trail.settings.section", "general");
const returnStore = createLocalStore<ViewMode>("trail.settings.return", "timeline");

export function openSettings() {
  const mode = modeStore.get();
  if (mode === "settings") return;
  returnStore.set(mode);
  modeStore.set("settings");
}

export function closeSettings() {
  const back = returnStore.get();
  modeStore.set(back === "settings" ? "timeline" : back);
}
