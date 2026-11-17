import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Archive, CalendarClock, ExternalLink, FolderOpen, HardDriveDownload, Layers, RotateCcw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useQuery } from "@/lib/useQuery";
import { pluralRu } from "@/lib/duration";
import { Button } from "@/components/ui/Button";
import { ActionRow, Row, RowList, SwitchRow } from "@/components/settings/tiles";
import { tooltip } from "@/components/ui/Tooltip";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  backupDirStore,
  backupEnabledStore,
  backupIntervalStore,
  backupKeepStore,
  backupLastStore,
  defaultBackupDir,
  resolveBackupDir,
  runBackup,
  restoreBackup,
  type BackupInterval,
} from "@/lib/backup";

const ICON = { size: 20, strokeWidth: 1.75 };

const INTERVAL_SEGMENTS: { value: BackupInterval; label: string }[] = [
  { value: "day", label: "Раз в день" },
  { value: "week", label: "Раз в неделю" },
];

const KEEP_OPTIONS = [3, 5, 10, 20].map((n) => ({
  value: String(n),
  label: `${n} ${pluralRu(n, ["бэкап", "бэкапа", "бэкапов"])}`,
}));

const REVEAL = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { type: "spring" as const, bounce: 0, duration: 0.34 },
};

export function PathText({ path }: { path: string }) {
  return (
    <span {...(path ? tooltip(path, "bottom") : {})} className="block truncate">
      {path || "—"}
    </span>
  );
}

export function OpenFolderButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Открыть папку"
      onClick={onClick}
      {...tooltip("Открыть папку", "bottom")}
      className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-2 text-muted transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 hover:text-app-text active:scale-[0.96]"
    >
      <ExternalLink size={18} strokeWidth={1.75} />
    </button>
  );
}

export function BackupPanel() {
  const { show } = useToast();
  const enabled = backupEnabledStore.use() === "1";
  const dir = backupDirStore.use();
  const interval = backupIntervalStore.use();
  const keep = backupKeepStore.use();
  const last = backupLastStore.use();

  const { data: fallbackDir } = useQuery(defaultBackupDir);

  const [busy, setBusy] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);

  const shownDir = dir || fallbackDir || "";
  const lastText = last
    ? `Последний — ${new Date(Number(last)).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}`
    : "Ещё не делался";

  async function pickDir() {
    const picked = await open({ directory: true, title: "Папка для бэкапов" });
    if (typeof picked === "string") backupDirStore.set(picked);
  }

  async function backupNow() {
    setBusy(true);
    try {
      await runBackup(await resolveBackupDir(), Number(keep || 0));
      show("Бэкап создан", "success");
    } catch (e) {
      show(String(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function openBackupDir() {
    try {
      await openPath(await resolveBackupDir());
    } catch (e) {
      show(String(e), "error");
    }
  }

  async function pickRestore() {
    const picked = await open({
      title: "Выбери бэкап",
      filters: [{ name: "Бэкап Trail", extensions: ["zip"] }],
    });
    if (typeof picked === "string") setPendingRestore(picked);
  }

  async function doRestore() {
    if (!pendingRestore) return;
    setBusy(true);
    try {
      await restoreBackup(pendingRestore);
    } catch (e) {
      setBusy(false);
      show(String(e), "error");
    }
  }

  return (
    <>
      <RowList title="Бэкап">
        <SwitchRow
          icon={<Archive {...ICON} />}
          title="Делать автоматически"
          description={lastText}
          checked={enabled}
          onChange={(v) => backupEnabledStore.set(v ? "1" : "0")}
        />
        <AnimatePresence initial={false}>
          {enabled && (
            <motion.div key="interval" {...REVEAL} className="relative overflow-hidden">
              <Row icon={<CalendarClock {...ICON} />} title="Как часто">
                <div className="w-[260px] shrink-0">
                  <SegmentedControl
                    segments={INTERVAL_SEGMENTS}
                    value={interval}
                    onChange={(v) => backupIntervalStore.set(v)}
                  />
                </div>
              </Row>
            </motion.div>
          )}
        </AnimatePresence>
        <Row icon={<Layers {...ICON} />} title="Сколько хранить" description="Самые старые удаляются">
          <div className="w-40 shrink-0">
            <Select options={KEEP_OPTIONS} value={keep} onChange={(v) => backupKeepStore.set(v)} />
          </div>
        </Row>
        <Row icon={<FolderOpen {...ICON} />} title="Папка бэкапов" description={<PathText path={shownDir} />}>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" onClick={pickDir}>
              Изменить
            </Button>
            <OpenFolderButton onClick={openBackupDir} />
          </div>
        </Row>
      </RowList>

      <RowList title="Вручную">
        <ActionRow
          icon={<HardDriveDownload {...ICON} />}
          title="Сделать бэкап сейчас"
          disabled={busy}
          onClick={backupNow}
        />
        <ActionRow
          icon={<RotateCcw {...ICON} />}
          title="Восстановить из бэкапа"
          description="Текущие данные заменятся, Trail перезапустится"
          disabled={busy}
          onClick={pickRestore}
        />
      </RowList>

      <ConfirmDialog
        open={pendingRestore !== null}
        title="Восстановить из бэкапа?"
        message="Текущие события, отметки, люди и фото будут заменены содержимым архива. Действие необратимо, приложение перезапустится."
        confirmLabel="Восстановить"
        onConfirm={doRestore}
        onClose={() => setPendingRestore(null)}
      />
    </>
  );
}
