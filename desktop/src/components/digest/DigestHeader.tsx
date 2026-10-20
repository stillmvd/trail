import { useState, type RefObject } from "react";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Archive, Check, MoreHorizontal, RefreshCw, Search, Settings, Star } from "lucide-react";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { pluralRu } from "@/lib/duration";

const ROUND =
  "grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-2 transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 active:scale-[0.96]";

function Progress({ read, total }: { read: number; total: number }) {
  const p = total ? Math.round((read / total) * 100) : 0;
  const left = total - read;
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="relative grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--ds-accent) ${p}%, var(--ds-surface-2) 0)` }}
      >
        <span className="absolute inset-1 rounded-full bg-surface-0" />
        <span className="relative text-[11px] font-bold text-app-text tabular-nums">{p}%</span>
      </span>
      <span className="flex flex-col leading-[1.2]">
        <b className="text-[13px] font-bold tabular-nums">
          {read} из {total}
        </b>
        <span className="text-xs text-[var(--ds-text-faint)]">{left ? `осталось ${left}` : "всё прочитано"}</span>
      </span>
    </span>
  );
}

export function DigestHeader({
  date,
  viewed,
  progress,
  query,
  searchRef,
  onQuery,
  onMarkViewed,
  onCollect,
  onSettings,
  saved,
  onToggleSaved,
  onArchive,
}: {
  saved: { count: number } | null;
  onToggleSaved: () => void;
  onArchive: () => void;
  date: string;
  viewed: boolean | null;
  progress: { read: number; total: number } | null;
  query: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onQuery: (q: string) => void;
  onMarkViewed: (() => void) | null;
  onCollect: () => void;
  onSettings: () => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [day, month] = format(parseISO(date), "d MMMM", { locale: ru }).split(" ");

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex shrink-0 flex-col gap-0.5">
        <h2 className="text-[32px] leading-[1.04] font-light tracking-[-0.02em] whitespace-nowrap text-app-text">
          {saved ? (
            <b className="font-bold">Сохранённое</b>
          ) : (
            <>
              <b className="font-bold">{day}</b> {month}
            </>
          )}
        </h2>
        {saved ? (
          <span className="text-[12.5px] font-medium text-[var(--ds-text-faint)]">
            {saved.count ? `${saved.count} ${pluralRu(saved.count, ["материал", "материала", "материалов"])}` : "пусто"}
          </span>
        ) : viewed !== null && (
          <span className="text-[12.5px] font-medium text-[var(--ds-text-faint)]">
            {viewed ? "просмотрена" : "новая"}
          </span>
        )}
      </div>
      <span className="min-w-2 flex-1" />
      {progress && !saved && <Progress read={progress.read} total={progress.total} />}

      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
        <label className="flex h-10 min-w-[150px] flex-[0_1_240px] items-center gap-2.5 rounded-full bg-surface-2 px-4">
          <Search size={16} strokeWidth={1.75} className="shrink-0 text-[var(--ds-text-faint)]" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              e.stopPropagation();
              onQuery("");
              e.currentTarget.blur();
            }}
            placeholder="Поиск"
            className="min-w-0 flex-1 bg-transparent text-sm text-app-text outline-none placeholder:text-muted"
          />
        </label>
        <button
          type="button"
          aria-label="Сохранённое"
          title="Сохранённое"
          aria-pressed={saved !== null}
          onClick={onToggleSaved}
          className={`${ROUND} ${saved ? "text-accent-ink" : "text-app-text"}`}
        >
          <Star size={18} strokeWidth={1.75} fill={saved ? "currentColor" : "none"} />
        </button>
        <button type="button" aria-label="Прошлые сводки" title="Прошлые сводки" onClick={onArchive} className={`${ROUND} text-app-text`}>
          <Archive size={18} strokeWidth={1.75} />
        </button>
        {!saved &&
          viewed !== null &&
          (viewed ? (
            <span className="inline-flex h-10 items-center gap-2 rounded-full px-[18px] text-sm font-semibold whitespace-nowrap text-muted shadow-[inset_0_0_0_1px_var(--rg-line)]">
              <Check size={18} strokeWidth={1.75} />
              Просмотрена
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onMarkViewed?.()}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-amber px-[18px] text-sm font-bold whitespace-nowrap text-ink transition-[scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96]"
            >
              <Check size={18} strokeWidth={1.75} />
              Просмотрено
            </button>
          ))}
        {!saved && (
          <button
            type="button"
            aria-label="Ещё"
            title="Ещё"
            onMouseDown={(e) => menu && e.stopPropagation()}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setMenu(menu ? null : { x: r.right - 180, y: r.bottom + 6 });
            }}
            className={`${ROUND} text-app-text`}
          >
            <MoreHorizontal size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <ContextMenu
        open={menu !== null}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        items={[
          { label: "Собрать сейчас", icon: <RefreshCw size={16} strokeWidth={1.75} />, onSelect: onCollect },
          { label: "Настройки сводки", icon: <Settings size={16} strokeWidth={1.75} />, onSelect: onSettings },
        ]}
        onClose={() => setMenu(null)}
      />
    </div>
  );
}
