import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Ban } from "lucide-react";
import { ContextMenu } from "@/components/ui/ContextMenu";
import { groupDigest, type DigestGroup } from "@/lib/digest/groups";
import { pluralRu } from "@/lib/duration";
import type { DigestEntry } from "@/db/queries/digests";
import { useDigest } from "./DigestProvider";
import { DigestCard } from "./DigestCard";
import { NearList } from "./NearList";
import { useDigestKeys } from "./useDigestKeys";

function GroupHead({ group }: { group: DigestGroup }) {
  const [first, ...rest] = group.title.split(" ");
  const n = group.entries.length;
  return (
    <div className="flex min-w-0 flex-col gap-px">
      <h3 className="text-[22px] leading-[1.1] font-light tracking-[-0.02em] text-app-text">
        <b className="font-bold">{first}</b> {rest.join(" ")}
      </h3>
      <span className="text-[12.5px] font-medium text-[var(--ds-text-faint)]">
        {n} {pluralRu(n, ["материал", "материала", "материалов"])}
      </span>
    </div>
  );
}

export function DigestView({ header }: { header?: ReactNode }) {
  const { digest, entries, topics, bannedDomains, openEntry, react, toggleStar, ban } = useDigest();
  const [menu, setMenu] = useState<{ x: number; y: number; domain: string } | null>(null);

  const groups = useMemo(() => (digest ? groupDigest(digest, entries, topics) : []), [digest, entries, topics]);
  const near = useMemo(() => entries.filter((e) => e.tier === "near"), [entries]);
  const order = useMemo(() => groups.flatMap((g) => g.entries), [groups]);

  const selectedId = useDigestKeys(order, { open: openEntry, react, star: toggleStar });

  const openMenu = (e: MouseEvent, entry: DigestEntry) => {
    if (!entry.domain) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, domain: entry.domain });
  };

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        {header}
        {!digest && <p className="py-20 text-center text-sm text-muted">Сводки ещё нет</p>}
        {groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-4">
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
                  onStar={() => toggleStar(entry)}
                  onMenu={(e) => openMenu(e, entry)}
                />
              ))}
            </div>
          </section>
        ))}
        <NearList entries={near} onOpen={openEntry} />
      </div>

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
