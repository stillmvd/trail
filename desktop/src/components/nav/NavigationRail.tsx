import {
  Waypoints,
  LayoutGrid,
  CalendarDays,
  Target,
  Bell,
  Cake,
  Newspaper,
  Search,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { modeStore, type ViewMode } from "../../lib/mode";
import { searchOpenStore } from "../../lib/search";

const DESTINATIONS: { value: ViewMode; label: string; icon: LucideIcon }[] = [
  { value: "timeline", label: "Таймлайн", icon: Waypoints },
  { value: "gallery", label: "Галерея", icon: LayoutGrid },
  { value: "calendar", label: "Календарь", icon: CalendarDays },
  { value: "tracking", label: "Отслеживание", icon: Target },
  { value: "reminders", label: "Напоминания", icon: Bell },
  { value: "birthdays", label: "Дни рождения", icon: Cake },
  { value: "digest", label: "Сводка", icon: Newspaper },
];

function RailButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
        active
          ? "bg-amber text-ink"
          : "text-muted hover:bg-surface-2 hover:text-app-text"
      }`}
    >
      <Icon size={20} strokeWidth={1.75} />
    </button>
  );
}

export function NavigationRail() {
  const mode = modeStore.use();

  return (
    <nav
      aria-label="Основная навигация"
      className="flex h-full w-[4.5rem] shrink-0 flex-col items-center gap-1.5 border-r border-line bg-surface-0 py-5"
    >
      {DESTINATIONS.map(({ value, label, icon }) => (
        <RailButton
          key={value}
          label={label}
          icon={icon}
          active={mode === value}
          onClick={() => modeStore.set(value)}
        />
      ))}

      <div className="flex-1" />

      <RailButton
        label="Поиск (/)"
        icon={Search}
        onClick={() => searchOpenStore.set(true)}
      />
      <RailButton
        label="Настройки"
        icon={Settings}
        active={mode === "settings"}
        onClick={() => modeStore.set("settings")}
      />
    </nav>
  );
}
