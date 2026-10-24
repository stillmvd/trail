import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { openArticle } from "@/lib/digest/open";
import { useQuery } from "@/lib/useQuery";
import { getSetting } from "@/db/queries/settings";
import { todayISO } from "@/lib/dates";
import { collectDigest, refreshUnseen, type CollectResult } from "@/lib/digest/collect";
import { loadDigestConfig, STATE_KEYS, type DigestConfig } from "@/lib/digest/config";
import { topicsFromInterests } from "@/lib/digest/pick";
import { ensureSeeded } from "@/lib/digest/seed";
import { bumpDigestVersion, digestRunStore, digestVersionStore, type DigestRun } from "@/lib/digest/stores";
import {
  allMainOpened,
  listDigests,
  listEntries,
  markDigestViewed,
  markEntryOpened,
  markMainOpened,
  type Digest,
  type DigestEntry,
} from "@/db/queries/digests";
import { banDomain, listBans, listSaved, setReaction, toggleSaved } from "@/db/queries/digestReactions";
import type { DigestItem } from "@/db/queries/digestItems";

export type SavedItem = DigestItem & { saved_at: string };

export type DigestStatus = {
  config: DigestConfig;
  lastError: string;
  lastAttemptAt: string | null;
  attemptsToday: number;
};

type DigestCtx = {
  run: DigestRun;
  status: DigestStatus | null;
  collect: () => Promise<CollectResult>;
  loaded: boolean;
  error: string | null;
  digests: Digest[];
  topics: string[];
  digest: Digest | null;
  entries: DigestEntry[];
  bannedDomains: Set<string>;
  picked: boolean;
  saved: SavedItem[];
  selectDigest: (id: number) => void;
  openEntry: (entry: DigestEntry) => Promise<void>;
  react: (entry: DigestEntry, value: 1 | -1) => Promise<void>;
  toggleStar: (itemId: number) => Promise<void>;
  ban: (domain: string) => Promise<void>;
  markViewed: () => Promise<void>;
};

const Context = createContext<DigestCtx | null>(null);

export function useDigest() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useDigest must be used within DigestProvider");
  return ctx;
}

async function loadStatus(): Promise<DigestStatus> {
  await ensureSeeded();
  const [config, lastError, lastAttemptAt, attemptsDate, attemptsCount] = await Promise.all([
    loadDigestConfig(),
    getSetting(STATE_KEYS.lastError),
    getSetting(STATE_KEYS.lastAttemptAt),
    getSetting(STATE_KEYS.attemptsDate),
    getSetting(STATE_KEYS.attemptsCount),
  ]);
  return {
    config,
    lastError: lastError ?? "",
    lastAttemptAt,
    attemptsToday: attemptsDate === todayISO() ? Number(attemptsCount ?? 0) : 0,
  };
}

async function viewIfDone(digestId: number) {
  if (!(await allMainOpened(digestId))) return;
  await markDigestViewed(digestId);
  await refreshUnseen();
}

export function DigestProvider({ children }: { children: ReactNode }) {
  const version = digestVersionStore.use();
  const run = digestRunStore.use();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadDigests = useCallback(() => listDigests(), [version]);
  const loadBans = useCallback(() => listBans(), [version]);
  const { data: digests, error } = useQuery(loadDigests);
  const { data: bans } = useQuery(loadBans);
  const loadSaved = useCallback(() => listSaved(), [version]);
  const { data: saved } = useQuery(loadSaved);
  const reloadStatus = useCallback(() => loadStatus(), [version, run]);
  const { data: status } = useQuery(reloadStatus);

  const digest = digests?.find((d) => d.id === selectedId) ?? digests?.[0] ?? null;
  const digestId = digest?.id ?? null;
  const loadEntries = useCallback(
    () => (digestId === null ? Promise.resolve([]) : listEntries(digestId)),
    [digestId, version],
  );
  const { data: entries } = useQuery(loadEntries);

  const collect = async () => {
    const result = await collectDigest({ manual: true });
    if (result.kind !== "busy") bumpDigestVersion();
    return result;
  };

  const openEntry = async (entry: DigestEntry) => {
    await openArticle(entry.url);
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

  const toggleStar = async (itemId: number) => {
    await toggleSaved(itemId);
    bumpDigestVersion();
  };

  const ban = async (domain: string) => {
    await banDomain(domain);
    bumpDigestVersion();
  };

  const markViewed = async () => {
    if (digestId === null) return;
    await markMainOpened(digestId);
    await markDigestViewed(digestId);
    await refreshUnseen();
    bumpDigestVersion();
  };

  return (
    <Context.Provider
      value={{
        loaded: digests !== null && status !== null && (digestId === null || entries !== null),
        error,
        digests: digests ?? [],
        topics: status ? topicsFromInterests(status.config.interests) : [],
        run,
        status,
        collect,
        digest,
        entries: entries ?? [],
        bannedDomains: new Set((bans ?? []).map((b) => b.domain)),
        picked: selectedId !== null && digest?.id === selectedId,
        saved: saved ?? [],
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
