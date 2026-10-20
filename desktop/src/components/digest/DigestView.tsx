import { useCallback, useMemo, useRef, useState, type MouseEvent } from "react";
import { Ban } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { useToast } from "@/components/ui/Toast";
import { groupDigest, isRead, type DigestGroup } from "@/lib/digest/groups";
import { emptyState } from "@/lib/digest/emptyState";
import { openRouterKeyStore } from "@/lib/openrouter";
import { todayISO } from "@/lib/dates";
import { modeStore } from "@/lib/mode";
import { pluralRu } from "@/lib/duration";
import { useQuery } from "@/lib/useQuery";
import { searchItems } from "@/db/queries/digestItems";
import type { DigestEntry } from "@/db/queries/digests";
import { useDigest } from "./DigestProvider";
import { DigestCard } from "./DigestCard";
import { DigestHeader } from "./DigestHeader";
import { DigestBusy, DigestEmpty, EMPTY_ICONS } from "./DigestEmpty";
import { DigestRows } from "./DigestRows";
import { DigestArchive } from "./DigestArchive";
import { DigestSaved } from "./DigestSaved";
import { NearList } from "./NearList";
import { useDigestKeys } from "./useDigestKeys";

const MATERIALS: [string, string, string] = ["материал", "материала", "материалов"];

function dayOf(iso: string | null): string | null {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? format(d, "d MMMM", { locale: ru }) : null;
}

function GroupHead({ group }: { group: DigestGroup }) {
  const [first, ...rest] = (group.topic || "Без темы").split(" ");
  const n = group.entries.length;
  return (
    <div className="flex min-w-0 flex-col gap-px">
      <h3 className="text-[22px] leading-[1.1] font-light tracking-[-0.02em] text-app-text">
        <b className="font-bold">{first}</b> {rest.join(" ")}
      </h3>
      <span className="text-[12.5px] font-medium text-[var(--ds-text-faint)]">
        {n} {pluralRu(n, MATERIALS)}
        {group.fresh > 0 && ` · ${group.fresh} ${pluralRu(group.fresh, ["новый", "новых", "новых"])}`}
      </span>
    </div>
  );
}

export function DigestView() {
  const {
    digests,
    digest,
    picked,
    saved,
    entries,
    topics,
    bannedDomains,
    run,
    status,
    collect,
    selectDigest,
    openEntry,
    react,
    toggleStar,
    ban,
    markViewed,
  } = useDigest();
  const { show } = useToast();
  const hasKey = openRouterKeyStore.use().trim() !== "";
  const [menu, setMenu] = useState<{ x: number; y: number; domain: string } | null>(null);
  const [query, setQuery] = useState("");
  const [savedView, setSavedView] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const today = todayISO();
  const empty =
    status && !picked
      ? emptyState({
          today,
          now: Date.now(),
          hasToday: digests.some((d) => d.date === today),
          hasAny: digests.length > 0,
          hasKey,
          lastError: status.lastError,
          lastAttemptAt: status.lastAttemptAt,
          attemptsToday: status.attemptsToday,
          config: status.config,
        })
      : null;
  const shown = empty ? null : digest;

  const groups = useMemo(() => (shown ? groupDigest(shown, entries, topics) : []), [shown, entries, topics]);
  const near = useMemo(() => (shown ? entries.filter((e) => e.tier === "near") : []), [shown, entries]);
  const main = useMemo(() => groups.flatMap((g) => g.entries), [groups]);

  const q = query.trim();
  const loadResults = useCallback(() => (q ? searchItems(q) : Promise.resolve([])), [q]);
  const { data: results } = useQuery(loadResults);

  const runCollect = async () => {
    const result = await collect();
    if (result.kind === "appended") show(result.added ? `Добавлено в сводку: ${result.added}` : "Нового не нашлось", "info");
    else if (result.kind === "empty" && digests.some((d) => d.date === today)) show(result.message, "info");
    else if (result.kind === "error" && !empty) show(result.message, "error");
  };
  const openSettings = () => modeStore.set("settings");

  const selectedId = useDigestKeys(q || savedView || archiveOpen ? [] : main, {
    open: openEntry,
    react,
    star: (entry) => toggleStar(entry.item_id),
    search: () => searchRef.current?.focus(),
  });

  const openMenu = (e: MouseEvent, entry: DigestEntry) => {
    if (!entry.domain) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, domain: entry.domain });
  };

  const emptyAction = () => {
    if (empty?.kind === "nokey") openSettings();
    else runCollect();
  };

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <DigestHeader
          date={shown?.date ?? today}
          viewed={shown ? shown.viewed_at !== null : null}
          progress={shown && main.length ? { read: main.filter(isRead).length, total: main.length } : null}
          query={query}
          searchRef={searchRef}
          onQuery={setQuery}
          onMarkViewed={shown ? markViewed : null}
          onCollect={runCollect}
          onSettings={openSettings}
          saved={savedView ? { count: saved.length } : null}
          onToggleSaved={() => setSavedView((v) => !v)}
          onArchive={() => setArchiveOpen(true)}
        />

        {q ? (
          results && results.length > 0 ? (
            <DigestRows
              rows={results.map((r) => ({
                key: r.id,
                title: r.title,
                source: r.source,
                meta: dayOf(r.published_at) ?? dayOf(r.found_at) ?? "",
                onOpen: () => openUrl(r.url),
              }))}
            />
          ) : (
            results && <p className="text-center text-[13px] text-muted">Ничего не нашлось</p>
          )
        ) : savedView ? (
          <DigestSaved items={saved} onUnsave={toggleStar} />
        ) : (
          <>
            {empty && run.state !== "running" && (
              <DigestEmpty
                icon={EMPTY_ICONS[empty.kind]}
                title={empty.title}
                text={empty.text}
                action={empty.action}
                error={empty.kind === "error"}
                onAction={emptyAction}
              />
            )}
            {groups.map((group) => (
              <section key={group.topic} className="flex flex-col gap-4">
                <GroupHead group={group} />
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] items-start gap-4">
                  {group.entries.map((entry) => (
                    <DigestCard
                      key={entry.item_id}
                      entry={entry}
                      selected={entry.item_id === selectedId}
                      banned={bannedDomains.has(entry.domain)}
                      onOpen={() => openEntry(entry)}
                      onReact={(value) => react(entry, value)}
                      onStar={() => toggleStar(entry.item_id)}
                      onMenu={(e) => openMenu(e, entry)}
                    />
                  ))}
                </div>
              </section>
            ))}
            {run.state === "running" && <DigestBusy />}
            <NearList entries={near} onOpen={openEntry} />
          </>
        )}
      </div>

      <DigestArchive
        open={archiveOpen}
        digests={digests}
        currentId={savedView ? null : (shown?.id ?? null)}
        onPick={(id) => {
          selectDigest(id);
          setSavedView(false);
          setArchiveOpen(false);
        }}
        onClose={() => setArchiveOpen(false)}
      />

      <ContextMenu
        open={menu !== null}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        items={[
          {
            label: "Больше не показывать этот домен",
            icon: <Ban size={16} strokeWidth={1.75} />,
            onSelect: () => menu && ban(menu.domain),
          },
        ]}
        onClose={() => setMenu(null)}
      />
    </div>
  );
}
