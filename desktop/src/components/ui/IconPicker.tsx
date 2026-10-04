import { createElement, useState } from "react";
import { Search } from "lucide-react";
import { ICON_NAMES, resolveIcon } from "@/lib/icons";

export function IconPicker({
  value,
  onChange,
  label,
  color,
}: {
  value: string;
  onChange: (icon: string) => void;
  label?: string;
  color?: string;
}) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q ? ICON_NAMES.filter((n) => n.toLowerCase().includes(q)) : ICON_NAMES;

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-medium text-muted">{label}</span>}

      <div className="flex h-11 items-center gap-2 rounded-full bg-surface-2 px-4">
        <Search size={15} className="shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск иконки…"
          className="h-9 w-full bg-transparent text-sm text-app-text outline-none placeholder:text-muted"
        />
      </div>

      <div className="mt-2 overflow-hidden rounded-3xl bg-surface-2">
        <div className="grid h-52 grid-cols-7 content-start gap-1.5 overflow-y-auto p-3">
        {filtered.map((name) => {
          const active = name === value;
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => onChange(name)}
              className={`grid aspect-square cursor-pointer place-items-center rounded-full transition-colors ${
                active ? "bg-surface-active text-app-text" : "text-app-text hover:bg-surface-3"
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
          <span className="col-span-7 px-2 py-3 text-center text-sm text-muted">
            Ничего не найдено
          </span>
        )}
        </div>
      </div>
    </div>
  );
}
