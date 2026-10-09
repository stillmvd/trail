import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { appDataDir } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { isEnabled, enable, disable } from "@tauri-apps/plugin-autostart";
import { Mark } from "@/components/brand/Mark";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { MarkTypeManager } from "@/components/settings/MarkTypeManager";
import { BackupPanel } from "@/components/settings/BackupPanel";
import { UpdatePanel } from "@/components/settings/UpdatePanel";
import { ImageGenPanel } from "@/components/settings/ImageGenPanel";
import { useLiveSeconds, setLiveSeconds } from "@/components/birthdays/useLiveSeconds";
import { themeStore, type ThemePref } from "@/lib/theme";
import { closeToTrayStore } from "@/lib/behavior";
import { notifyBirthdaysStore, notifyRemindersStore } from "@/lib/notifications";
import { useQuery } from "@/lib/useQuery";

const THEME_SEGMENTS: { value: ThemePref; label: string }[] = [
  { value: "system", label: "Системная" },
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-4xl bg-surface-1 p-7">
      <div>
        <h2 className="inline-flex rounded-full bg-surface-2 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          {title}
        </h2>
        {description && <p className="mt-2.5 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-medium text-app-text">{title}</span>
        {description && <span className="text-[13px] leading-snug text-muted">{description}</span>}
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const theme = themeStore.use();
  const liveSeconds = useLiveSeconds();
  const closeToTray = closeToTrayStore.use() === "1";
  const notifyBirthdays = notifyBirthdaysStore.use() === "1";
  const notifyReminders = notifyRemindersStore.use() === "1";
  const { show } = useToast();
  const { data: version } = useQuery(getVersion);
  const { data: autostart, reload: reloadAutostart } = useQuery(isEnabled);

  async function openDataFolder() {
    try {
      await openPath(await appDataDir());
    } catch (e) {
      show(String(e), "error");
    }
  }

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
    <div className="h-full overflow-y-auto px-10 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="m-0 mb-3 text-xs font-medium uppercase tracking-[0.24em] text-muted">
            trail · приложение
          </p>
          <h1 className="m-0 text-4xl font-bold leading-none tracking-[-0.045em]">Настройки</h1>
        </div>

        <Section title="Внешний вид" description="Тема оформления приложения.">
          <SegmentedControl
            segments={THEME_SEGMENTS}
            value={theme}
            onChange={(v) => themeStore.set(v)}
          />
        </Section>

        <Section title="Поведение">
          <Row
            title="Запускать при входе в Windows"
            description="Приложение стартует свёрнутым в трей"
          >
            <Switch
              checked={autostart ?? false}
              onChange={toggleAutostart}
              label="Запускать при входе в Windows"
            />
          </Row>
          <Row
            title="Сворачивать в трей при закрытии"
            description="Крестик прячет окно, приложение остаётся в трее"
          >
            <Switch
              checked={closeToTray}
              onChange={(v) => closeToTrayStore.set(v ? "1" : "0")}
              label="Сворачивать в трей при закрытии"
            />
          </Row>
        </Section>

        <Section title="Уведомления">
          <Row
            title="Напоминать о днях рождения"
            description="Windows-уведомление в день рождения, пока приложение запущено"
          >
            <Switch
              checked={notifyBirthdays}
              onChange={(v) => notifyBirthdaysStore.set(v ? "1" : "0")}
              label="Напоминать о днях рождения"
            />
          </Row>
          <Row
            title="Уведомления о напоминаниях"
            description="Срабатывания, пропущенные и предварительные оповещения раздела «Напоминания»"
          >
            <Switch
              checked={notifyReminders}
              onChange={(v) => notifyRemindersStore.set(v ? "1" : "0")}
              label="Уведомления о напоминаниях"
            />
          </Row>
        </Section>

        <Section title="Дни рождения">
          <Row
            title="Живой отсчёт секунд"
            description="Тикающие секунды на карточках в последние дни до дня рождения"
          >
            <Switch
              checked={liveSeconds}
              onChange={setLiveSeconds}
              label="Живой отсчёт секунд"
            />
          </Row>
        </Section>

        <Section
          title="Картинки"
          description="Иллюстрация к событию по названию и заметке. Сцену придумывает бесплатная модель OpenRouter, Cloudflare или локальная LM Studio — что доступно."
        >
          <ImageGenPanel />
        </Section>

        <Section title="Обновления" description="Новые версии скачиваются с GitHub в фоне и ставятся при перезапуске.">
          <UpdatePanel />
        </Section>

        <Section title="Бэкап" description="Архив с базой и фотографиями в выбранной папке.">
          <BackupPanel />
        </Section>

        <Section title="Данные" description="База и медиа хранятся в папке приложения.">
          <div>
            <Button variant="secondary" onClick={openDataFolder}>
              <FolderOpen size={15} strokeWidth={1.75} />
              Открыть папку данных
            </Button>
          </div>
        </Section>

        <Section title="Справочники" description="Категории событий и типы быстрых отметок.">
          <CategoryManager />
          <MarkTypeManager />
        </Section>

        <section className="flex items-center gap-5 rounded-4xl bg-amber p-7 text-ink">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-ink">
            <Mark size={40} />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-[28px] font-bold leading-none tracking-tight">Trail</p>
            <p className="m-0 mt-1.5 text-sm opacity-70">Личный таймлайн жизни</p>
          </div>
          <span
            className="ml-auto shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold tabular-nums"
            style={{ background: "color-mix(in srgb, var(--ds-on-accent) 12%, transparent)" }}
          >
            версия {version ?? "—"}
          </span>
        </section>
      </div>
    </div>
  );
}
