import { format, isSameWeek, isSameYear, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { SideSheet } from "@/components/ui/SideSheet";
import { pluralRu } from "@/lib/duration";
import type { Digest } from "@/db/queries/digests";
import { FUSED } from "./DigestRows";

const MATERIALS: [string, string, string] = ["материал", "материала", "материалов"];

function ArchiveGroup({
  title,
  digests,
  currentId,
  onPick,
}: {
  title: string;
  digests: Digest[];
  currentId: number | null;
  onPick: (id: number) => void;
}) {
  if (digests.length === 0) return null;
  const now = new Date();
  return (
    <section className="flex flex-col gap-1">
      <h3 className="pl-4 text-xs font-bold tracking-[0.02em] text-[var(--ds-text-faint)] uppercase">{title}</h3>
      <div className="flex flex-col gap-0.5">
        {digests.map((d) => {
          const date = parseISO(d.date);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onPick(d.id)}
              className={`flex min-h-[52px] w-full min-w-0 cursor-pointer items-center gap-3 px-4 py-2 text-left transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${FUSED} ${
                d.id === currentId ? "bg-surface-active" : "bg-surface-2 hover:bg-surface-3"
              }`}
            >
              <span className="flex min-w-0 flex-col leading-[1.25]">
                <b className="text-sm font-semibold whitespace-nowrap text-app-text">
                  {format(date, isSameYear(date, now) ? "d MMMM" : "d MMMM yyyy", { locale: ru })}
                </b>
                <span className="truncate text-xs text-[var(--ds-text-faint)]">
                  {d.main_count} {pluralRu(d.main_count, MATERIALS)}
                </span>
              </span>
              {d.viewed_at === null && (
                <span className="ml-auto inline-flex h-[22px] shrink-0 items-center rounded-full bg-amber px-2.5 text-[11px] font-bold whitespace-nowrap text-ink">
                  новая
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function DigestArchive({
  open,
  digests,
  currentId,
  onPick,
  onClose,
}: {
  open: boolean;
  digests: Digest[];
  currentId: number | null;
  onPick: (id: number) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const thisWeek = digests.filter((d) => isSameWeek(parseISO(d.date), now, { weekStartsOn: 1 }));
  const earlier = digests.filter((d) => !thisWeek.includes(d));

  return (
    <SideSheet open={open} onClose={onClose} title="Прошлые сводки">
      {digests.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted">Сводок пока нет</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ArchiveGroup title="На этой неделе" digests={thisWeek} currentId={currentId} onPick={onPick} />
          <ArchiveGroup title="Раньше" digests={earlier} currentId={currentId} onPick={onPick} />
        </div>
      )}
    </SideSheet>
  );
}
