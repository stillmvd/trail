import { createLocalStore } from "./localStore";

export type ViewMode =
  | "timeline"
  | "gallery"
  | "calendar"
  | "tracking"
  | "reminders"
  | "birthdays"
  | "digest"
  | "settings";

export const modeStore = createLocalStore<ViewMode>("trail.mode", "timeline");
