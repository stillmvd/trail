import { CircleMinus, Key, Newspaper, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";

export function DigestEmpty({
  icon: Icon,
  title,
  text,
  action,
  error,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: string;
  error?: boolean;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-4xl bg-surface-1 px-6 py-11 text-center">
      <Icon size={30} strokeWidth={1.5} className="text-[var(--ds-text-faint)]" />
      <b className={`text-base font-bold ${error ? "text-rust" : "text-app-text"}`}>{title}</b>
      <p className="max-w-[42ch] text-[13px] text-muted">{text}</p>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="mt-1 inline-flex h-10 cursor-pointer items-center rounded-full bg-amber px-[18px] text-sm font-bold text-ink transition-[scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96]"
        >
          {action}
        </button>
      )}
    </div>
  );
}

export function DigestBusy() {
  return (
    <div className="flex items-center gap-2.5 rounded-3xl bg-surface-1 px-4 py-3 text-[13px] text-muted">
      <RefreshCw size={16} strokeWidth={1.75} className="shrink-0 animate-spin" />
      Собираю свежие материалы…
    </div>
  );
}

export const EMPTY_ICONS = { error: TriangleAlert, none: CircleMinus, nokey: Key, pending: Newspaper };
