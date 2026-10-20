import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useQuery } from "@/lib/useQuery";
import { refreshUnseen } from "@/lib/digest/collect";
import { bumpDigestVersion, digestVersionStore } from "@/lib/digest/stores";
import {
  allMainOpened,
  listDigests,
  listEntries,
  markDigestViewed,
  markEntryOpened,
  type Digest,
  type DigestEntry,
} from "@/db/queries/digests";
import { banDomain, listBans, setReaction, toggleSaved } from "@/db/queries/digestReactions";

type DigestCtx = {
  digests: Digest[];
  digest: Digest | null;
  entries: DigestEntry[];
  bannedDomains: Set<string>;
  selectDigest: (id: number) => void;
  openEntry: (entry: DigestEntry) => Promise<void>;
  react: (entry: DigestEntry, value: 1 | -1) => Promise<void>;
  toggleStar: (entry: DigestEntry) => Promise<void>;
  ban: (domain: string) => Promise<void>;
  markViewed: () => Promise<void>;
};

const Context = createContext<DigestCtx | null>(null);

export function useDigest() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useDigest must be used within DigestProvider");
  return ctx;
}

async function viewIfDone(digestId: number) {
  if (!(await allMainOpened(digestId))) return;
  await markDigestViewed(digestId);
  await refreshUnseen();
}

export function DigestProvider({ children }: { children: ReactNode }) {
  const version = digestVersionStore.use();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadDigests = useCallback(() => listDigests(), [version]);
  const loadBans = useCallback(() => listBans(), [version]);
  const { data: digests } = useQuery(loadDigests);
  const { data: bans } = useQuery(loadBans);

  const digest = digests?.find((d) => d.id === selectedId) ?? digests?.[0] ?? null;
  const digestId = digest?.id ?? null;
  const loadEntries = useCallback(
    () => (digestId === null ? Promise.resolve([]) : listEntries(digestId)),
    [digestId, version],
  );
  const { data: entries } = useQuery(loadEntries);

  const openEntry = async (entry: DigestEntry) => {
    await openUrl(entry.url);
    await markEntryOpened(entry.digest_id, entry.item_id);
    await viewIfDone(entry.digest_id);
    bumpDigestVersion();
  };

  const react = async (entry: DigestEntry, value: 1 | -1) => {
    const next = entry.reaction === value ? null : value;
    await setReaction(entry.item_id, next);
    if (next === -1) {
      await markEntryOpened(entry.digest_id, entry.item_id);
      await viewIfDone(entry.digest_id);
    }
    bumpDigestVersion();
  };

  const toggleStar = async (entry: DigestEntry) => {
    await toggleSaved(entry.item_id);
    bumpDigestVersion();
  };

  const ban = async (domain: string) => {
    await banDomain(domain);
    bumpDigestVersion();
  };

  const markViewed = async () => {
    if (digestId === null) return;
    await markDigestViewed(digestId);
    await refreshUnseen();
    bumpDigestVersion();
  };

  return (
    <Context.Provider
      value={{
        digests: digests ?? [],
        digest,
        entries: entries ?? [],
        bannedDomains: new Set((bans ?? []).map((b) => b.domain)),
        selectDigest: setSelectedId,
        openEntry,
        react,
        toggleStar,
        ban,
        markViewed,
      }}
    >
      {children}
    </Context.Provider>
  );
}
