import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Star } from "lucide-react";
import { openArticle } from "@/lib/digest/open";
import type { SavedItem } from "./DigestProvider";
import { DigestEmpty } from "./DigestEmpty";
import { tooltip } from "@/components/ui/Tooltip";

export function DigestSaved({ items, onUnsave }: { items: SavedItem[]; onUnsave: (itemId: number) => void }) {
  if (items.length === 0) {
    return (
      <DigestEmpty
        icon={Star}
        title="Пока ничего не сохранено"
        text="Звезда на карточке откладывает материал сюда — он остаётся, даже когда сводка уезжает в архив."
      />
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start gap-4">
      {items.map((item) => (
        <article
          key={item.id}
          className="flex min-w-0 flex-col gap-2.5 rounded-4xl bg-surface-1 p-3 transition-[scale] duration-200 ease-[var(--rg-ease)] has-[[data-open]:active]:scale-[0.96]"
        >
          <button type="button" data-open onClick={() => openArticle(item.url)} className="flex cursor-pointer flex-col gap-2.5 text-left">
            <span className="line-clamp-2 text-[15px] leading-[1.3] font-semibold text-app-text">{item.title}</span>
            <span className="text-[12.5px] text-[var(--ds-text-faint)]">
              <b className="font-semibold text-muted">{item.source}</b> · сохранено{" "}
              {format(parseISO(item.saved_at), "d MMMM", { locale: ru })}
            </span>
          </button>
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Убрать из сохранённого"
              {...tooltip("Убрать из сохранённого", "bottom")}
              onClick={() => onUnsave(item.id)}
              className="ml-auto grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-full bg-surface-2 text-accent-ink transition-[scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96]"
            >
              <Star size={15} strokeWidth={1.75} fill="currentColor" />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
