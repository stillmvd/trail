import { useEffect } from "react";
import { AnimatePresence, motion, type Transition, type Variants } from "motion/react";
import {
  ArrowLeft,
  Waypoints,
  LayoutGrid,
  CalendarDays,
  Target,
  Cake,
  Search,
  Settings,
  SlidersHorizontal,
  Tags,
  Sparkles,
  Database,
  type LucideIcon,
} from "lucide-react";
import { tooltip } from "@/components/ui/Tooltip";
import { UpdateLine } from "@/components/settings/UpdateLine";
import { useBack } from "@/lib/back";
import { modeStore, type ViewMode } from "@/lib/mode";
import { searchOpenStore } from "@/lib/search";
import { closeSettings, openSettings, settingsSectionStore, type SettingsSection } from "@/lib/settingsNav";

const DESTINATIONS: { value: ViewMode; label: string; icon: LucideIcon }[] = [
  { value: "timeline", label: "Таймлайн", icon: Waypoints },
  { value: "gallery", label: "Галерея", icon: LayoutGrid },
  { value: "calendar", label: "Календарь", icon: CalendarDays },
  { value: "tracking", label: "Отслеживание", icon: Target },
  { value: "birthdays", label: "Дни рождения", icon: Cake },
];

const SECTIONS: { value: SettingsSection; label: string; icon: LucideIcon }[] = [
  { value: "general", label: "Общие", icon: SlidersHorizontal },
  { value: "refs", label: "Справочники", icon: Tags },
  { value: "images", label: "Картинки", icon: Sparkles },
  { value: "data", label: "Данные", icon: Database },
];

const WIDTH: Transition = { type: "spring", bounce: 0, duration: 0.42 };
const PILL: Transition = { type: "spring", bounce: 0, duration: 0.32 };
const IN: Transition = { type: "spring", bounce: 0, duration: 0.36 };
const OUT: Transition = { duration: 0.12, ease: [0.4, 0, 1, 1] };

const appList: Variants = {
  show: { transition: { staggerChildren: 0.022, delayChildren: 0.06 } },
  hide: { transition: { staggerChildren: 0.012, staggerDirection: -1 } },
};
const appItem: Variants = {
  hidden: { opacity: 0, x: -12, filter: "blur(4px)" },
  show: { opacity: 1, x: 0, filter: "blur(0px)", transition: IN },
  hide: { opacity: 0, x: -12, filter: "blur(4px)", transition: OUT },
};

const gearItem: Variants = {
  hidden: { opacity: 0, rotate: -90, scale: 0.8 },
  show: { opacity: 1, rotate: 0, scale: 1, transition: IN },
  hide: { opacity: 0, rotate: 90, scale: 0.8, transition: { ...OUT, duration: 0.16 } },
};

const setList: Variants = {
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.08 } },
  hide: { transition: { staggerChildren: 0.01, staggerDirection: -1 } },
};
const setItem: Variants = {
  hidden: { opacity: 0, x: 18, filter: "blur(4px)" },
  show: { opacity: 1, x: 0, filter: "blur(0px)", transition: IN },
  hide: { opacity: 0, x: 18, filter: "blur(4px)", transition: OUT },
};

const swap = {
  initial: { opacity: 0, y: 6, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { ...IN, delay: 0.1 } },
  exit: { opacity: 0, y: 6, filter: "blur(4px)", transition: OUT },
};

const press = "active:scale-[0.96] transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)]";

function AppList({ mode }: { mode: ViewMode }) {
  return (
    <motion.div
      variants={appList}
      initial="hidden"
      animate="show"
      exit="hide"
      className="absolute inset-x-0 top-0 flex flex-col gap-1.5 px-3.5"
    >
      {DESTINATIONS.map(({ value, label, icon: Icon }) => {
        const active = mode === value;
        return (
          <motion.button
            key={value}
            variants={appItem}
            type="button"
            onClick={() => modeStore.set(value)}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            {...tooltip(label)}
            className={`relative grid h-11 w-11 cursor-pointer place-items-center rounded-full ${press} ${
              active ? "text-ink" : "text-muted hover:bg-surface-2 hover:text-app-text"
            }`}
          >
            {active && (
              <motion.span layoutId="rail-pill" transition={PILL} className="absolute inset-0 rounded-full bg-amber" />
            )}
            <Icon size={20} strokeWidth={1.75} className="relative" />
          </motion.button>
        );
      })}
    </motion.div>
  );
}

function SettingsList() {
  const section = settingsSectionStore.use();
  return (
    <motion.div
      variants={setList}
      initial="hidden"
      animate="show"
      exit="hide"
      className="absolute inset-x-0 top-0 flex flex-col gap-1.5 px-3.5"
    >
      <motion.button
        variants={setItem}
        type="button"
        onClick={closeSettings}
        aria-label="Закрыть настройки"
        className={`group mb-3 flex h-11 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full pr-4 text-app-text hover:bg-surface-2 ${press}`}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center text-muted transition-[color,translate] duration-200 ease-[var(--rg-ease)] group-hover:-translate-x-0.5 group-hover:text-app-text">
          <ArrowLeft size={20} strokeWidth={1.75} />
        </span>
        <span className="text-[15px] font-semibold">Настройки</span>
      </motion.button>
      <div role="tablist" aria-orientation="vertical" aria-label="Разделы настроек" className="flex flex-col gap-1.5">
        {SECTIONS.map(({ value, label, icon: Icon }) => {
          const active = section === value;
          return (
            <motion.button
              key={value}
              variants={setItem}
              type="button"
              role="tab"
              id={`settings-tab-${value}`}
              aria-selected={active}
              aria-controls="settings-panel"
              onClick={() => settingsSectionStore.set(value)}
              className={`relative flex h-11 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full pr-4 text-[15px] font-medium ${press} ${
                active ? "text-app-text" : "text-muted hover:bg-surface-2 hover:text-app-text"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="settings-pill"
                  transition={PILL}
                  className="absolute inset-0 rounded-full bg-surface-active"
                />
              )}
              <span className="relative grid h-11 w-11 shrink-0 place-items-center">
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <span className="relative">{label}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

function useEscapeToClose(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const target = e.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (document.querySelector("[role=dialog]")) return;
      closeSettings();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}

export function NavigationRail() {
  const mode = modeStore.use();
  const inSettings = mode === "settings";
  useBack(inSettings, closeSettings);
  useEscapeToClose(inSettings);

  return (
    <motion.nav
      aria-label="Основная навигация"
      initial={false}
      animate={{ width: inSettings ? 232 : 72 }}
      transition={WIDTH}
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-line bg-surface-0 py-5"
    >
      <div className="relative min-h-0 flex-1">
        <AnimatePresence initial={false}>
          {inSettings ? <SettingsList key="settings" /> : <AppList key="app" mode={mode} />}
        </AnimatePresence>
      </div>

      <div className="relative h-[100px] shrink-0">
        <AnimatePresence initial={false}>
          {inSettings ? (
            <motion.div key="update" {...swap} className="absolute inset-x-2.5 bottom-0">
              <UpdateLine stacked />
            </motion.div>
          ) : (
            <motion.div
              key="app"
              variants={appList}
              initial="hidden"
              animate="show"
              exit="hide"
              className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 px-3.5"
            >
              <motion.button
                variants={appItem}
                type="button"
                onClick={() => searchOpenStore.set(true)}
                aria-label="Поиск"
                {...tooltip("Поиск")}
                className={`grid h-11 w-11 cursor-pointer place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-app-text ${press}`}
              >
                <Search size={20} strokeWidth={1.75} />
              </motion.button>
              <motion.button
                variants={gearItem}
                type="button"
                onClick={openSettings}
                aria-label="Настройки"
                {...tooltip("Настройки")}
                className={`grid h-11 w-11 cursor-pointer place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-app-text ${press}`}
              >
                <Settings size={20} strokeWidth={1.75} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  );
}
