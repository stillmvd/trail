import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { openArticle } from "@/lib/digest/open";
import { useToast } from "@/components/ui/Toast";
import { getQueryData, revalidateQuery, setQueryData, useQuery } from "@/lib/useQuery";
import { getSettings } from "@/db/queries/settings";
import { todayISO } from "@/lib/dates";
import { collectDigest, refreshUnseen, type CollectResult } from "@/lib/digest/collect";
import { loadDigestConfig, STATE_KEYS, type DigestConfig } from "@/lib/digest/config";
import { topicsFromInterests } from "@/lib/digest/pick";
import { ensureSeeded } from "@/lib/digest/seed";
import { bumpDigestVersion, digestRunStore, digestVersionStore, type DigestRun } from "@/lib/digest/stores";
import {
  allMainOpened,
  clearDigestViewed,
  clearEntryOpened,
  listDigests,
  listEntries,
  markDigestViewed,
  markEntryOpened,
  markMainOpened,
  type Digest,
  type DigestEntry,
} from "@/db/queries/digests";
import {
  banDomain,
  listBans,
  listSaved,
  setReaction,
  toggleSaved,
  type DigestBan,
} from "@/db/queries/digestReactions";
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
  toggleSeen: (entry: DigestEntry) => Promise<void>;
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

const STATUS_KEYS = [STATE_KEYS.lastError, STATE_KEYS.lastAttemptAt, STATE_KEYS.attemptsDate, STATE_KEYS.attemptsCount];

export async function loadStatus(): Promise<DigestStatus> {
  await ensureSeeded();
  const [config, state] = await Promise.all([loadDigestConfig(), getSettings(STATUS_KEYS)]);
  return {
    config,
    lastError: state[STATE_KEYS.lastError] ?? "",
    lastAttemptAt: state[STATE_KEYS.lastAttemptAt] ?? null,
    attemptsToday: state[STATE_KEYS.attemptsDate] === todayISO() ? Number(state[STATE_KEYS.attemptsCount] ?? 0) : 0,
  };
}

async function viewIfDone(digestId: number) {
  if (!(await allMainOpened(digestId))) return;
  await markDigestViewed(digestId);
  await refreshUnseen();
}

export const entriesKey = (digestId: number | null) => `digest-entries:${digestId ?? "none"}`;
const noEntries = () => Promise.resolve<DigestEntry[]>([]);

const runRev = (run: DigestRun) => (run.state === "idle" ? 0 : run.state === "running" ? 1 : 2);

type Patch = { key: unknown; apply: (data: never) => unknown };

export function DigestProvider({ children }: { children: ReactNode }) {
  const { show } = useToast();
  const version = digestVersionStore.use();
  const run = digestRunStore.use();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: digests, error } = useQuery(listDigests, { rev: version });
  const { data: bans } = useQuery(listBans, { rev: version });
  const { data: saved } = useQuery(listSaved, { rev: version });
  const { data: status } = useQuery(loadStatus, { rev: version * 3 + runRev(run) });

  const digest = digests?.find((d) => d.id === selectedId) ?? digests?.[0] ?? null;
  const digestId = digest?.id ?? null;
  const eKey = entriesKey(digestId);
  const loadEntries = useCallback(() => (digestId === null ? noEntries() : listEntries(digestId)), [digestId]);
  const { data: entries } = useQuery(loadEntries, { key: eKey, rev: version });

  const collect = useCallback(async () => {
    const result = await collectDigest({ manual: true });
    if (result.kind !== "busy") bumpDigestVersion();
    return result;
  }, []);

  const mutate = useCallback(
    async (patches: Patch[], write: () => Promise<void>, revalidate: unknown[], failure: string) => {
      const snapshot = patches.map((p) => [p.key, getQueryData(p.key)] as const);
      for (const p of patches) {
        setQueryData<unknown>(p.key, (d: unknown) => (d === null ? null : (p.apply as (x: unknown) => unknown)(d)));
      }
      const keys = new Set([...revalidate, ...patches.map((p) => p.key)]);
      try {
        await write();
      } catch (e) {
        keys.add(listDigests);
        for (const [key, data] of snapshot) setQueryData(key, data);
        show(`${failure}: ${String(e)}`, "error");
        await refreshUnseen().catch(() => undefined);
      }
      await Promise.all([...keys].map((k) => revalidateQuery(k)));
    },
    [show],
  );

  const setOpened = useCallback(
    (itemId: number, openedAt: string | null): Patch => ({
      key: eKey,
      apply: ((list: DigestEntry[]) =>
        list.map((e) => (e.item_id === itemId ? { ...e, opened_at: openedAt } : e))) as Patch["apply"],
    }),
    [eKey],
  );

  const openEntry = useCallback(
    async (entry: DigestEntry) => {
      try {
        await openArticle(entry.url);
      } catch (e) {
        show(`Не удалось открыть ссылку: ${String(e)}`, "error");
        return;
      }
      const now = new Date().toISOString();
      await mutate(
        [setOpened(entry.item_id, entry.opened_at ?? now)],
        async () => {
          await markEntryOpened(entry.digest_id, entry.item_id);
          await viewIfDone(entry.digest_id);
        },
        [listDigests],
        "Не удалось отметить статью",
      );
    },
    [mutate, setOpened, show],
  );

  const react = useCallback(
    async (entry: DigestEntry, value: 1 | -1) => {
      const next = entry.reaction === value ? null : value;
      const now = new Date().toISOString();
      const patch: Patch = {
        key: eKey,
        apply: ((list: DigestEntry[]) =>
          list.map((e) =>
            e.item_id === entry.item_id
              ? { ...e, reaction: next, opened_at: next !== null && e.opened_at === null ? now : e.opened_at }
              : e,
          )) as Patch["apply"],
      };
      await mutate(
        [patch],
        async () => {
          await setReaction(entry.item_id, next);
          if (next !== null) {
            await markEntryOpened(entry.digest_id, entry.item_id);
            await viewIfDone(entry.digest_id);
          }
        },
        [listDigests],
        "Не удалось сохранить реакцию",
      );
    },
    [mutate, eKey],
  );

  const toggleSeen = useCallback(
    async (entry: DigestEntry) => {
      const marking = entry.opened_at === null;
      await mutate(
        [setOpened(entry.item_id, marking ? new Date().toISOString() : null)],
        async () => {
          if (marking) {
            await markEntryOpened(entry.digest_id, entry.item_id);
            await viewIfDone(entry.digest_id);
          } else {
            await clearEntryOpened(entry.digest_id, entry.item_id);
            if (!(await allMainOpened(entry.digest_id))) {
              await clearDigestViewed(entry.digest_id);
              await refreshUnseen();
            }
          }
        },
        [listDigests],
        "Не удалось изменить отметку",
      );
    },
    [mutate, setOpened],
  );

  const toggleStar = useCallback(
    async (itemId: number) => {
      const wasSaved = getQueryData<SavedItem[]>(listSaved)?.some((s) => s.id === itemId) ?? false;
      const patches: Patch[] = [
        {
          key: eKey,
          apply: ((list: DigestEntry[]) =>
            list.map((e) => (e.item_id === itemId ? { ...e, saved: wasSaved ? 0 : 1 } : e))) as Patch["apply"],
        },
      ];
      if (wasSaved) {
        patches.push({
          key: listSaved,
          apply: ((list: SavedItem[]) => list.filter((s) => s.id !== itemId)) as Patch["apply"],
        });
      }
      await mutate(
        patches,
        async () => {
          await toggleSaved(itemId);
        },
        [listSaved],
        "Не удалось изменить избранное",
      );
    },
    [mutate, eKey],
  );

  const ban = useCallback(
    async (domain: string) => {
      await mutate(
        [
          {
            key: listBans,
            apply: ((list: DigestBan[]) =>
              list.some((b) => b.domain === domain)
                ? list
                : [{ domain, created_at: new Date().toISOString() }, ...list]) as Patch["apply"],
          },
        ],
        () => banDomain(domain),
        [listBans],
        "Не удалось заблокировать источник",
      );
    },
    [mutate],
  );

  const markViewed = useCallback(async () => {
    if (digestId === null) return;
    const now = new Date().toISOString();
    await mutate(
      [
        {
          key: eKey,
          apply: ((list: DigestEntry[]) =>
            list.map((e) => (e.tier === "main" && e.opened_at === null ? { ...e, opened_at: now } : e))) as Patch["apply"],
        },
        {
          key: listDigests,
          apply: ((list: Digest[]) =>
            list.map((d) => (d.id === digestId ? { ...d, viewed_at: d.viewed_at ?? now } : d))) as Patch["apply"],
        },
      ],
      async () => {
        await markMainOpened(digestId);
        await markDigestViewed(digestId);
        await refreshUnseen();
      },
      [listDigests, eKey],
      "Не удалось отметить сводку просмотренной",
    );
  }, [digestId, eKey, mutate]);

  const bannedDomains = useMemo(() => new Set((bans ?? []).map((b) => b.domain)), [bans]);
  const topics = useMemo(() => (status ? topicsFromInterests(status.config.interests) : []), [status]);

  const value = useMemo<DigestCtx>(
    () => ({
      loaded: digests !== null && status !== null && (digestId === null || entries !== null),
      error,
      digests: digests ?? [],
      topics,
      run,
      status,
      collect,
      digest,
      entries: entries ?? [],
      bannedDomains,
      picked: selectedId !== null && digest?.id === selectedId,
      saved: saved ?? [],
      selectDigest: setSelectedId,
      openEntry,
      react,
      toggleSeen,
      toggleStar,
      ban,
      markViewed,
    }),
    [
      digests,
      status,
      digestId,
      entries,
      error,
      topics,
      run,
      collect,
      digest,
      bannedDomains,
      selectedId,
      saved,
      openEntry,
      react,
      toggleSeen,
      toggleStar,
      ban,
      markViewed,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}
