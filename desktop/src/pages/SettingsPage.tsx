import { type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowDownToLine, Cake, Database, Monitor, Moon, Palette, Power, Sun } from "lucide-react";
import { settingsSectionStore, type SettingsSection } from "@/lib/settingsNav";
import { appearList } from "@/lib/appear";
import { appDataDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import { tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { MarkTypeManager } from "@/components/settings/MarkTypeManager";
import { BackupPanel, OpenFolderButton, PathText } from "@/components/settings/BackupPanel";
import { ImageGenPanel } from "@/components/settings/ImageGenPanel";
import { Row, RowList, SwitchRow } from "@/components/settings/tiles";
import { themeStore, type ThemePref } from "@/lib/theme";
import { closeToTrayStore } from "@/lib/behavior";
import { notifyBirthdaysStore } from "@/lib/notifications";
import { useQuery } from "@/lib/useQuery";

const THEMES: { value: ThemePref; label: string; icon: ReactNode }[] = [
  { value: "system", label: "Системная", icon: <Monitor size={20} strokeWidth={1.75} /> },
  { value: "light", label: "Светлая", icon: <Sun size={20} strokeWidth={1.75} /> },
  { value: "dark", label: "Тёмная", icon: <Moon size={20} strokeWidth={1.75} /> },
];

function arrows<T>(e: KeyboardEvent<HTMLElement>, list: T[], current: T, pick: (v: T) => void) {
  const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const i = (list.indexOf(current) + step + list.length) % list.length;
  pick(list[i]);
  e.currentTarget.querySelectorAll<HTMLElement>("[role=tab], [role=radio]")[i]?.focus();
}

function ThemePicker() {
  const theme = themeStore.use();
  return (
    <div
      role="radiogroup"
      aria-label="Тема"
      onKeyDown={(e) =>
        arrows(
          e,
          THEMES.map((t) => t.value),
          theme,
          (v) => themeStore.set(v),
        )
      }
      className="flex shrink-0 gap-1.5"
    >
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          role="radio"
          tabIndex={theme === t.value ? 0 : -1}
          aria-checked={theme === t.value}
          aria-label={t.label}
          onClick={() => themeStore.set(t.value)}
          {...tooltip(t.label, "bottom")}
          className={`grid h-11 w-11 cursor-pointer place-items-center rounded-full transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
            theme === t.value ? "bg-surface-active text-app-text" : "bg-surface-2 text-muted hover:bg-surface-3"
          }`}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

function GeneralSection() {
  const closeToTray = closeToTrayStore.use() === "1";
  const notifyBirthdays = notifyBirthdaysStore.use() === "1";
  const { show } = useToast();
  const { data: autostart, reload: reloadAutostart } = useQuery(isEnabled);

  async function toggleAutostart(next: boolean) {
    try {
      if (next) await enable();
      else await disable();
      reloadAutostart();
    } catch (e) {
      show(String(e), "error");
    }
  }

  return (
    <RowList>
      <Row icon={<Palette size={20} strokeWidth={1.75} />} title="Тема">
        <ThemePicker />
      </Row>
      <SwitchRow
        icon={<Power size={20} strokeWidth={1.75} />}
        title="Запускать вместе с Windows"
        checked={autostart ?? false}
        onChange={toggleAutostart}
      />
      <SwitchRow
        icon={<ArrowDownToLine size={20} strokeWidth={1.75} />}
        title="Сворачивать в трей при закрытии"
        description={closeToTray ? undefined : "Крестик закроет Trail — уведомления не придут"}
        checked={closeToTray}
        onChange={(v) => closeToTrayStore.set(v ? "1" : "0")}
      />
      <SwitchRow
        icon={<Cake size={20} strokeWidth={1.75} />}
        title="Уведомления о днях рождения"
        checked={notifyBirthdays}
        onChange={(v) => notifyBirthdaysStore.set(v ? "1" : "0")}
      />
    </RowList>
  );
}

function RefsSection() {
  return (
    <>
      <CategoryManager />
      <MarkTypeManager />
    </>
  );
}

function DataSection() {
  const { show } = useToast();
  const { data: dataDir } = useQuery(appDataDir);

  async function openDataFolder() {
    try {
      await openPath(await appDataDir());
    } catch (e) {
      show(String(e), "error");
    }
  }

  return (
    <>
      <BackupPanel />
      <RowList title="На диске">
        <Row
          icon={<Database size={20} strokeWidth={1.75} />}
          title="Папка данных"
          description={<PathText path={dataDir ?? ""} />}
        >
          <OpenFolderButton onClick={openDataFolder} />
        </Row>
      </RowList>
    </>
  );
}

const BODIES: Record<SettingsSection, () => ReactNode> = {
  general: GeneralSection,
  refs: RefsSection,
  images: ImageGenPanel,
  data: DataSection,
};

export function SettingsPage() {
  const section = settingsSectionStore.use();
  const Body = BODIES[section] ?? GeneralSection;

  return (
    <div className="h-full overflow-y-auto px-12 pb-12 pt-10">
      <div className="mx-auto flex max-w-[840px] flex-col gap-7">
        <motion.div
          key={section}
          {...appearList}
          id="settings-panel"
          role="tabpanel"
          aria-labelledby={`settings-tab-${section}`}
          className="flex flex-col gap-7"
        >
          <Body />
        </motion.div>
      </div>
    </div>
  );
}
