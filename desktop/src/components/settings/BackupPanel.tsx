import { useState, type ReactNode } from "react";
import { FolderOpen, Archive, RotateCcw, ExternalLink } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { useQuery } from "@/lib/useQuery";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
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

const INTERVAL_SEGMENTS: { value: BackupInterval; label: string }[] = [
  { value: "day", label: "Раз в день" },
  { value: "week", label: "Раз в неделю" },
];

const KEEP_OPTIONS = [3, 5, 10, 20].map((n) => ({
  value: String(n),
  label: `${n}`,
}));

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
      <div className="flex flex-col">
        <span className="text-sm text-app-text">{title}</span>
        {description && <span className="text-xs text-muted">{description}</span>}
      </div>
      {children}
    </div>
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
    <div className="flex flex-col gap-3">
      <Row
        title="Автоматический бэкап"
        description={
          last
            ? `Последний: ${new Date(Number(last)).toLocaleString("ru-RU")}`
            : "Ещё не выполнялся"
        }
      >
        <Switch
          checked={enabled}
          onChange={(v) => backupEnabledStore.set(v ? "1" : "0")}
          label="Автоматический бэкап"
        />
      </Row>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">
          Папка для бэкапов{!dir && " (по умолчанию)"}
        </span>
        <div className="flex items-center gap-2">
          <span
            title={shownDir}
            className="min-w-0 flex-1 truncate rounded-full bg-surface-2 px-4 py-2.5 text-sm text-app-text"
          >
            {shownDir || "—"}
          </span>
          <Button variant="secondary" onClick={pickDir}>
            <FolderOpen size={15} strokeWidth={1.75} />
            Выбрать
          </Button>
          {(dir || last) && (
            <Button variant="ghost" onClick={openBackupDir}>
              <ExternalLink size={15} strokeWidth={1.75} />
              Открыть
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted">Как часто</span>
        <SegmentedControl
          segments={INTERVAL_SEGMENTS}
          value={interval}
          onChange={(v) => backupIntervalStore.set(v)}
        />
      </div>

      <Select
        label="Хранить последних архивов"
        options={KEEP_OPTIONS}
        value={keep}
        onChange={(v) => backupKeepStore.set(v)}
      />

      <div className="mt-1 flex gap-2">
        <Button variant="secondary" onClick={backupNow} disabled={busy}>
          <Archive size={15} strokeWidth={1.75} />
          Сделать бэкап сейчас
        </Button>
        <Button variant="ghost" onClick={pickRestore} disabled={busy}>
          <RotateCcw size={15} strokeWidth={1.75} />
          Восстановить из файла
        </Button>
      </div>

      <ConfirmDialog
        open={pendingRestore !== null}
        title="Восстановить из бэкапа?"
        message="Текущие события, отметки, люди и фото будут заменены содержимым архива. Действие необратимо, приложение перезапустится."
        confirmLabel="Восстановить"
        onConfirm={doRestore}
        onClose={() => setPendingRestore(null)}
      />
    </div>
  );
}
