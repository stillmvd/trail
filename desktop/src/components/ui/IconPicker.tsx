import { createElement, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { ICON_NAMES, resolveIcon } from "@/lib/icons";

export function IconPicker({
  value,
  onChange,
  label,
  color,
  columns = 7,
  raised = false,
}: {
  value: string;
  onChange: (icon: string) => void;
  label?: string;
  color?: string;
  columns?: 7 | 8;
  raised?: boolean;
}) {
  const [query, setQuery] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const filtered = q ? ICON_NAMES.filter((n) => n.toLowerCase().includes(q)) : ICON_NAMES;

  useEffect(() => {
    const grid = gridRef.current;
    const active = grid?.querySelector<HTMLElement>("[aria-pressed=true]");
    if (!grid || !active) return;
    grid.scrollTop = active.offsetTop - grid.clientHeight / 2 + active.offsetHeight / 2;
  }, []);

  const field = raised ? "bg-surface-3" : "bg-surface-2";
  const hover = raised ? "hover:bg-surface-active" : "hover:bg-surface-3";

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-muted">{label}</span>}

      <div className={`flex h-11 items-center gap-2 rounded-full px-4 ${field}`}>
        <Search size={15} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Название значка по-английски"
          className="h-9 w-full bg-transparent text-sm text-app-text outline-none placeholder:text-muted"
        />
      </div>

      <div className={`mt-2 overflow-hidden rounded-3xl ${field}`}>
        <div
          ref={gridRef}
          className={`relative grid h-52 content-start gap-1.5 overflow-y-auto p-3 ${
            columns === 8 ? "grid-cols-8" : "grid-cols-7"
          }`}
        >
          {filtered.map((name) => {
            const active = name === value;
            return (
              <button
                key={name}
                type="button"
                title={name}
                aria-pressed={active}
                onClick={() => onChange(name)}
                className={`grid aspect-square cursor-pointer place-items-center rounded-full transition-colors ${
                  active ? "bg-surface-active text-app-text" : `text-app-text ${hover}`
                }`}
              >
                {createElement(resolveIcon(name), {
                  size: 18,
                  style: active || !color ? undefined : { color },
                })}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <span className="col-span-full px-2 py-3 text-center text-sm text-muted">Нет значка «{query.trim()}» — введи название по-английски</span>
          )}
        </div>
      </div>
    </div>
  );
}
