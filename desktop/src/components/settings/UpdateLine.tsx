import { useState } from "react";
import { checkNow, installNow, useShip } from "@stillmvd/tauri-ship";
import { Mark } from "@/components/brand/Mark";
import { Button } from "@/components/ui/Button";
import { tooltip } from "@/components/ui/Tooltip";

function checkedAgo(ms: number): string {
  const minutes = Math.floor((Date.now() - ms) / 60_000);
  if (minutes < 1) return "проверено только что";
  if (minutes < 60) return `проверено ${minutes} мин назад`;
  return `проверено в ${new Date(ms).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
}

export function UpdateLine({ stacked = false }: { stacked?: boolean }) {
  const { status } = useShip();
  const [checking, setChecking] = useState(false);
  const phase = status?.phase ?? "idle";
  const available = status?.available ?? null;
  const percent = status?.total ? Math.round((status.downloaded / status.total) * 100) : null;
  const busy = checking || phase !== "idle";

  async function check() {
    if (busy) return;
    setChecking(true);
    try {
      await checkNow();
    } catch {
    } finally {
      setChecking(false);
    }
  }

  const version = `Trail ${available?.version ?? status?.current ?? "—"}`;
  const state = available
    ? phase === "downloading"
      ? `скачивается${percent !== null ? ` ${percent} %` : ""}`
      : phase === "installing"
        ? "ставится…"
        : phase === "ready"
          ? "обновление скачано"
          : status?.error
            ? "не удалось скачать"
            : "ждёт скачивания"
    : checking || phase === "checking"
      ? "проверяется…"
      : status?.error
        ? "не удалось проверить"
        : status?.lastCheck
          ? checkedAgo(status.lastCheck)
          : "ещё не проверялось";
  const failed = status?.error && phase === "idle" && !checking;
  const restart = phase === "ready" || phase === "installing";

  if (stacked) {
    return (
      <div className="flex flex-col gap-2" aria-live="polite">
        <button
          type="button"
          onClick={check}
          aria-disabled={busy}
          {...tooltip(status?.error ? `Не удалось проверить: ${status.error}` : "Проверить обновления")}
          className="group flex min-w-0 cursor-pointer items-center gap-2.5 rounded-3xl py-1.5 pr-3 pl-3 text-left transition-colors duration-150 ease-[var(--rg-ease)] hover:bg-surface-2 aria-disabled:cursor-default aria-disabled:hover:bg-transparent"
        >
          <span className="shrink-0">
            <Mark size={20} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium text-app-text">{version}</span>
            <span className={`truncate text-xs ${failed ? "text-rust" : "text-muted"}`}>{state}</span>
          </span>
        </button>
        {restart && (
          <Button
            onClick={() => installNow().catch(() => {})}
            disabled={phase === "installing"}
            {...tooltip("Windows запросит подтверждение, затем Trail откроется заново")}
            className="h-9 w-full text-[13px]"
          >
            Перезапустить
          </Button>
        )}
      </div>
    );
  }

  const text = `${version} · ${state}`;

  return (
    <div className="flex h-10 min-w-0 items-center gap-2.5 text-[13px] text-muted" aria-live="polite">
      <button
        type="button"
        onClick={check}
        aria-disabled={busy}
        {...tooltip(status?.error ? `Не удалось проверить: ${status.error}` : "Проверить обновления", "bottom")}
        className="flex h-10 min-w-0 cursor-pointer items-center gap-2.5 rounded-full px-3 transition-colors duration-150 ease-[var(--rg-ease)] hover:text-app-text aria-disabled:cursor-default aria-disabled:hover:text-muted"
      >
        <span className="shrink-0">
          <Mark size={20} />
        </span>
        <span className={`truncate ${failed ? "text-rust" : ""}`}>{text}</span>
      </button>
      {restart ? (
        <Button
          onClick={() => installNow().catch(() => {})}
          disabled={phase === "installing"}
          {...tooltip("Windows запросит подтверждение, затем Trail откроется заново", "bottom")}
          className="h-8 shrink-0 px-3.5 text-[13px]"
        >
          Перезапустить
        </Button>
      ) : null}
    </div>
  );
}
