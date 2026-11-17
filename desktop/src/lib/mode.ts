import { createLocalStore } from "./localStore";

export type ViewMode =
  | "timeline"
  | "gallery"
  | "calendar"
  | "tracking"
  | "reminders"
  | "birthdays"
  | "settings";

// TODO: удалить после 1.0 — чистка следов удалённой «Сводки».
for (const key of ["trail.digest.model", "trail.notifyDigest"]) localStorage.removeItem(key);
if (localStorage.getItem("trail.mode") === "digest") localStorage.removeItem("trail.mode");

export const modeStore = createLocalStore<ViewMode>("trail.mode", "timeline");
