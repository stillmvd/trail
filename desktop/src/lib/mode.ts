import { createLocalStore } from "./localStore";

export type ViewMode = "timeline" | "gallery" | "calendar" | "tracking" | "birthdays" | "settings";

// TODO: удалить после 1.0 — чистка следов удалённой «Сводки».
for (const key of ["trail.digest.model", "trail.notifyDigest"]) localStorage.removeItem(key);
if (["digest", "reminders"].includes(localStorage.getItem("trail.mode") ?? "")) localStorage.removeItem("trail.mode");
localStorage.removeItem("trail.notifyReminders");

export const modeStore = createLocalStore<ViewMode>("trail.mode", "timeline");
