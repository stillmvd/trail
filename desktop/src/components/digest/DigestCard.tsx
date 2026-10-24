import { useState, type MouseEvent, type ReactNode } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Check, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { CoverPlaceholder } from "@/components/ui/CoverPlaceholder";
import { previewSrc } from "@/lib/paths";
import type { DigestEntry } from "@/db/queries/digests";
import { tooltip } from "@/components/ui/Tooltip";

export function formatPublished(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "d MMM, HH:mm", { locale: ru }).replace(".", "");
}

function ActButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      {...tooltip(label, "bottom")}
      onClick={onClick}
      className={`grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${className}`}
    >
      {children}
    </button>
  );
}

const IDLE = "bg-surface-2 text-muted hover:text-app-text";
const SECONDARY = "text-[var(--ds-text-secondary)]";

export function DigestCard({
  entry,
  selected,
  banned,
  onOpen,
  onReact,
  onSeen,
  onStar,
  onMenu,
}: {
  entry: DigestEntry;
  selected: boolean;
  banned: boolean;
  onOpen: () => void;
  onReact: (value: 1 | -1) => void;
  onSeen: () => void;
  onStar: () => void;
  onMenu: (e: MouseEvent) => void;
}) {
  const [broken, setBroken] = useState(false);
  const date = formatPublished(entry.published_at);
  const seen = entry.opened_at !== null;
  const src = entry.preview_file && !broken ? previewSrc(entry.preview_file) : "";

  return (
    <article
      data-digest-item={entry.item_id}
      onContextMenu={onMenu}
      className={`flex min-w-0 flex-col gap-3 rounded-4xl p-3 transition-[background-color,opacity,scale] duration-200 ease-[var(--rg-ease)] has-[[data-open]:active]:scale-[0.96] ${
        selected ? "bg-surface-active" : "bg-surface-1"
      } ${banned ? "opacity-30" : seen ? "opacity-55" : ""}`}
    >
      <button type="button" data-open onClick={onOpen} className="flex cursor-pointer flex-col gap-3 text-left">
        <span className="block h-[150px] shrink-0 overflow-hidden rounded-3xl bg-surface-2">
          {src ? (
            <img src={src} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
          ) : (
            <CoverPlaceholder fill="" />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-2">
          <span className="line-clamp-3 text-[15px] leading-[1.3] font-semibold tracking-[-0.01em] text-app-text">
            {entry.title}
          </span>
          {entry.why && (
            <span className={`line-clamp-3 text-[13px] leading-[1.35] ${selected ? SECONDARY : "text-muted"}`}>
              {entry.why}
            </span>
          )}
          <span className={`truncate text-[12.5px] ${selected ? SECONDARY : "text-[var(--ds-text-faint)]"}`}>
            <b className={`font-semibold ${selected ? "text-app-text" : "text-muted"}`}>{entry.source}</b>
            {date && ` · ${date}`}
          </span>
        </span>
      </button>

      <div className="mt-auto flex items-center gap-1.5 pt-0.5">
        <ActButton
          label="Нравится"
          onClick={() => onReact(1)}
          className={entry.reaction === 1 ? "bg-amber text-ink" : IDLE}
        >
          <ThumbsUp size={16} strokeWidth={1.75} />
        </ActButton>
        <ActButton
          label="Не нравится"
          onClick={() => onReact(-1)}
          className={entry.reaction === -1 ? "bg-rust text-ink" : IDLE}
        >
          <ThumbsDown size={16} strokeWidth={1.75} />
        </ActButton>
        <span className="flex-1" />
        <ActButton
          label={seen ? "Снять отметку о просмотре" : "Отметить просмотренным"}
          onClick={onSeen}
          className={seen ? "bg-surface-2 text-accent-ink" : IDLE}
        >
          <Check size={16} strokeWidth={1.75} />
        </ActButton>
        <ActButton
          label={entry.saved ? "Убрать из сохранённого" : "В сохранённое"}
          onClick={onStar}
          className={entry.saved ? "bg-surface-2 text-accent-ink" : IDLE}
        >
          <Star size={16} strokeWidth={1.75} fill={entry.saved ? "currentColor" : "none"} />
        </ActButton>
      </div>
    </article>
  );
}
