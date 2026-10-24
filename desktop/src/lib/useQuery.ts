import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { subscribeDataVersion, getDataVersion } from "./dataVersion";

type Entry = {
  data: unknown;
  has: boolean;
  rev: number;
  runSeq: number;
  listeners: Set<() => void>;
  fetcher: (() => Promise<unknown>) | null;
  inflight: { tag: string; promise: Promise<void> } | null;
  pinned: boolean;
};

type Key = unknown;

const MAX_ENTRIES = 60;
const entries = new Map<Key, Entry>();

function evict() {
  if (entries.size <= MAX_ENTRIES) return;
  for (const [key, e] of entries) {
    if (entries.size <= MAX_ENTRIES) break;
    if (e.listeners.size === 0 && !e.inflight && !e.pinned) entries.delete(key);
  }
}

function getEntry(key: Key): Entry {
  let e = entries.get(key);
  if (!e) {
    e = { data: null, has: false, rev: 0, runSeq: 0, listeners: new Set(), fetcher: null, inflight: null, pinned: false };
    entries.set(key, e);
    evict();
  }
  return e;
}

function emit(e: Entry) {
  e.listeners.forEach((l) => l());
}

function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function getQueryData<T>(key: Key): T | null {
  const e = entries.get(key);
  return e && e.has ? (e.data as T) : null;
}

export function setQueryData<T>(key: Key, next: T | null | ((prev: T | null) => T | null)): void {
  const e = getEntry(key);
  const prev = e.has ? (e.data as T) : null;
  const value = typeof next === "function" ? (next as (p: T | null) => T | null)(prev) : next;
  e.rev++;
  e.data = value;
  e.has = value !== null;
  emit(e);
}

let seq = 0;

function runFetch(e: Entry, fetcher: () => Promise<unknown>, tag: string): Promise<void> {
  if (e.inflight && e.inflight.tag === tag) return e.inflight.promise;
  const rev = e.rev;
  const run = ++e.runSeq;
  const promise: Promise<void> = fetcher()
    .then((d) => {
      if (run !== e.runSeq) return;
      if (e.rev !== rev) {
        if (e.fetcher) void runFetch(e, e.fetcher, `r${++seq}`).catch(() => undefined);
        return;
      }
      if (e.has && sameData(e.data, d)) return;
      e.data = d;
      e.has = true;
      emit(e);
    })
    .finally(() => {
      if (e.inflight && e.inflight.promise === promise) e.inflight = null;
    });
  e.inflight = { tag, promise };
  return promise;
}

export function revalidateQuery(key: Key): Promise<void> {
  const e = entries.get(key);
  if (!e || !e.fetcher) return Promise.resolve();
  return runFetch(e, e.fetcher, `r${++seq}`).catch(() => undefined);
}

export function prefetchQuery<T>(fn: () => Promise<T>, options?: { key?: string }): Promise<T | null> {
  const e = getEntry(options?.key ?? fn);
  e.pinned = true;
  e.fetcher = fn;
  return runFetch(e, fn, `p${++seq}`).then(
    () => (e.has ? (e.data as T) : null),
    () => null,
  );
}

export function useQuery<T>(
  fn: () => Promise<T>,
  options?: { key?: string; rev?: number; keepPrevious?: boolean },
): {
  data: T | null;
  error: string | null;
  reload: () => void;
} {
  const key: Key = options?.key ?? fn;
  const extraRev = options?.rev ?? 0;
  const keepPrevious = options?.keepPrevious ?? false;
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [held, setHeld] = useState<T | null>(null);
  const version = useSyncExternalStore(subscribeDataVersion, getDataVersion);

  const subscribe = useCallback(
    (cb: () => void) => {
      const e = getEntry(key);
      entries.delete(key);
      entries.set(key, e);
      e.listeners.add(cb);
      return () => {
        e.listeners.delete(cb);
      };
    },
    [key],
  );
  const cached = useSyncExternalStore(subscribe, () => {
    const e = getEntry(key);
    return e.has ? (e.data as T) : null;
  });

  if (keepPrevious && cached !== null && held !== cached) setHeld(cached);
  const data = cached ?? (keepPrevious ? held : null);

  useEffect(() => {
    const e = getEntry(key);
    e.fetcher = fn;
    let alive = true;
    runFetch(e, fn, `${version}:${extraRev}:${tick}`).then(
      () => alive && setError(null),
      (err) => alive && setError(String(err)),
    );
    return () => {
      alive = false;
    };
  }, [fn, key, tick, version, extraRev]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, reload };
}
