export type DigestRow = { key: number; title: string; source: string; onOpen: () => void };

export function DigestRows({ rows }: { rows: DigestRow[] }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {rows.map((row) => (
        <li key={row.key}>
          <button
            type="button"
            onClick={row.onOpen}
            className="flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md bg-surface-1 px-[18px] py-2.5 text-left text-[13px] text-muted transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] in-[li:first-child]:rounded-t-3xl in-[li:last-child]:rounded-b-3xl hover:bg-surface-2 hover:text-app-text active:scale-[0.96]"
          >
            <span className="min-w-0 flex-1 truncate">{row.title}</span>
            <span className="shrink-0 text-xs text-[var(--ds-text-faint)]">{row.source}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
