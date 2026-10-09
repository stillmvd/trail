import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { checkNow, installNow, useShip } from "@stillmvd/tauri-ship";
import { Button } from "@/components/ui/Button";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} МБ`;
}

function checkedAgo(ms: number): string {
  const minutes = Math.floor((Date.now() - ms) / 60_000);
  if (minutes < 1) return "Проверено только что";
  if (minutes < 60) return `Проверено ${minutes} мин назад`;
  return `Проверено в ${new Date(ms).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
}

export function UpdatePanel() {
  const { status } = useShip();
  const [checking, setChecking] = useState(false);
  const phase = status?.phase ?? "idle";
  const available = status?.available ?? null;
  const busy = checking || phase !== "idle";
  const percent = status?.total ? Math.round((status.downloaded / status.total) * 100) : null;
  const ready = phase === "ready" || phase === "installing";

  async function check() {
    setChecking(true);
    try {
      await checkNow();
    } catch {
    } finally {
      setChecking(false);
    }
  }

  const hint =
    checking || phase === "checking"
      ? "Проверяю…"
      : status?.lastCheck
        ? `${checkedAgo(status.lastCheck)}${available ? "" : " · последняя версия"}`
        : "Ещё не проверялось";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-[15px] font-medium text-app-text">
            Версия {status?.current ?? "—"}
          </span>
          <span className="text-[13px] text-muted">{hint}</span>
        </div>
        <Button variant="secondary" onClick={check} disabled={busy}>
          <RefreshCw
            size={15}
            strokeWidth={1.75}
            className={checking || phase === "checking" ? "animate-spin" : ""}
          />
          Проверить
        </Button>
      </div>

      {available && (
        <div className="flex flex-col gap-3.5 rounded-3xl bg-surface-2 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-app-text">
                Версия {available.version}
              </span>
              <span className="text-xs text-muted" aria-live="polite">
                {phase === "downloading"
                  ? `Скачивается: ${formatBytes(status?.downloaded ?? 0)}${status?.total ? ` из ${formatBytes(status.total)}` : ""}`
                  : phase === "installing"
                    ? "Ставится, приложение сейчас перезапустится"
                    : phase === "ready"
                      ? "Скачана. Windows спросит права, затем Trail откроется заново"
                      : "Ждёт скачивания"}
              </span>
            </div>
            {ready && (
              <Button onClick={() => installNow().catch(() => {})} disabled={phase === "installing"}>
                <Download size={15} strokeWidth={1.75} />
                Перезапустить для обновления
              </Button>
            )}
          </div>
          {phase === "downloading" && (
            <div
              className="h-1.5 overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              aria-label="Скачивание обновления"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent ?? undefined}
            >
              <div
                className="h-full rounded-full bg-amber transition-transform duration-200 ease-[var(--rg-ease)]"
                style={{
                  transform: `scaleX(${(percent ?? 0) / 100})`,
                  transformOrigin: "left",
                }}
              />
            </div>
          )}
        </div>
      )}

      {status?.error && (
        <span className="text-[13px] text-rust [overflow-wrap:anywhere]">
          Последняя ошибка: {status.error}
        </span>
      )}
    </div>
  );
}
