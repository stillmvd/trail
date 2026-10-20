import type { ReactNode } from "react";

export const FUSED = "rounded-md first:rounded-t-3xl last:rounded-b-3xl";

export function CapsHead({ children }: { children: ReactNode }) {
  return <h3 className="pl-4 text-xs font-bold tracking-[0.02em] text-[var(--ds-text-faint)] uppercase">{children}</h3>;
}

export type DigestRow = { key: number; title: string; source: string; meta?: string; onOpen: () => void };

export function DigestRows({ rows }: { rows: DigestRow[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          onClick={row.onOpen}
          className={`flex w-full min-w-0 cursor-pointer bg-surface-1 text-left transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-2 active:scale-[0.96] ${FUSED} ${
            row.meta
              ? "min-h-14 flex-col justify-center px-4 py-2 leading-[1.3]"
              : "items-center gap-2.5 px-[18px] py-2.5 text-[13px] text-muted hover:text-app-text"
          }`}
        >
          {row.meta ? (
            <>
              <span className="truncate text-sm font-semibold text-app-text">{row.title}</span>
              <span className="truncate text-xs text-[var(--ds-text-faint)]">
                {row.source} · {row.meta}
              </span>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate">{row.title}</span>
              <span className="shrink-0 text-xs text-[var(--ds-text-faint)]">{row.source}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
