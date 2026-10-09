import { lazy, Suspense, type ComponentType } from "react";
import { Titlebar } from "./components/Titlebar";
import { NavigationRail } from "./components/nav/NavigationRail";
import { ToastProvider } from "./components/ui/Toast";
import { EventsProvider } from "./components/events/EventsProvider";
import { PeopleProvider } from "./components/events/PeopleProvider";
import { RemindersProvider } from "./components/events/RemindersProvider";
import { SearchHost } from "./components/search/SearchHost";
import { UpdateToast } from "@stillmvd/tauri-ship";
import { modeStore, type ViewMode } from "./lib/mode";
import { useApplyTheme } from "./lib/theme";
import { useCloseToTray } from "./lib/behavior";
import { useNotifications } from "./lib/notifications";
import { useAutoBackup } from "./lib/backup";
import { SettingsPage } from "./pages/SettingsPage";
import { GalleryPage } from "./pages/GalleryPage";
import { CalendarPage } from "./pages/CalendarPage";
import { TrackingPage } from "./pages/TrackingPage";
import { RemindersPage } from "./pages/RemindersPage";
import { BirthdaysPage } from "./pages/BirthdaysPage";
import { TimelinePage } from "./pages/TimelinePage";

const PAGES: Record<ViewMode, ComponentType> = {
  timeline: TimelinePage,
  gallery: GalleryPage,
  calendar: CalendarPage,
  tracking: TrackingPage,
  reminders: RemindersPage,
  birthdays: BirthdaysPage,
  settings: SettingsPage,
};

const Agentation = import.meta.env.DEV
  ? lazy(() => import("agentation").then((m) => ({ default: m.Agentation })))
  : null;

export default function App() {
  useApplyTheme();
  useCloseToTray();
  useNotifications();
  useAutoBackup();
  const mode = modeStore.use();
  const Page = PAGES[mode];

  return (
    <ToastProvider>
      <RemindersProvider>
        <EventsProvider>
          <PeopleProvider>
            <div className="flex h-screen flex-col bg-surface-0 text-app-text">
              <Titlebar />
              <div className="flex min-h-0 flex-1">
                <NavigationRail />
                <main className="min-h-0 flex-1 overflow-hidden">
                  <Page />
                </main>
              </div>
            </div>
            <SearchHost />
            <UpdateToast lang="ru" />
            {Agentation && (
              <Suspense>
                <Agentation appName="Trail" endpoint="http://localhost:4747" />
              </Suspense>
            )}
          </PeopleProvider>
        </EventsProvider>
      </RemindersProvider>
    </ToastProvider>
  );
}
