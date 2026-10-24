import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { listAllMediaRefs, replaceMediaPath, snapshotDatabase, type MediaRef } from "@/db/queries/media";
import { getSetting, setSetting } from "@/db/queries/settings";
import { deleteMediaFile, encodeImage, putMedia } from "./media";
import { mediaSrc, thumbName, thumbSrc } from "./paths";
import { bumpDataVersion } from "./dataVersion";

export type OptimizeStats = {
  files: number;
  converted: number;
  thumbs: number;
  failed: number;
  before: number;
  after: number;
};

const PARALLEL = 2;
const SKIP_KEY = "media_optimize_skip";
const ORPHAN_AGE_S = 3600;
const MAX_ORPHAN_SHARE = 0.2;

async function runLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

async function processFile(path: string, refs: MediaRef[], stats: OptimizeStats) {
  const res = await fetch(mediaSrc(path));
  if (!res.ok) throw new Error(`нет файла ${path}`);
  const blob = await res.blob();
  const needsFull = !path.endsWith(".webp");
  const r = await encodeImage(blob, !needsFull);
  if (r.error === "worker") throw new WorkerFailure(r.error);
  if (r.error || !r.thumb) throw new Error(r.error ?? "нет миниатюры");
  stats.before += blob.size;

  if (needsFull && r.full) {
    const name = `${crypto.randomUUID()}.webp`;
    await putMedia(name, r.full);
    await putMedia(thumbName(name), r.thumb, true);
    const moved = await Promise.all(refs.map((ref) => replaceMediaPath(ref, name)));
    if (moved.every(Boolean)) await deleteMediaFile(path);
    else if (!moved.some(Boolean)) await deleteMediaFile(name);
    stats.converted++;
    stats.after += r.full.size;
  } else {
    await putMedia(thumbName(path), r.thumb, true);
    stats.after += blob.size;
  }
  stats.thumbs++;
}

async function sweepOrphans(): Promise<void> {
  const refs = await listAllMediaRefs();
  const live = new Set(refs.map((r) => r.path));
  const liveThumbs = new Set(refs.map((r) => thumbName(r.path)));
  const files = await invoke<[string, number][]>("list_media_files");
  const orphans = files.filter(([name, age]) =>
    age >= ORPHAN_AGE_S && (name.startsWith("thumbs/") ? !liveThumbs.has(name.slice(7)) : !live.has(name)),
  );
  const originals = files.filter(([name]) => !name.startsWith("thumbs/")).length;
  if (!refs.length || orphans.length > Math.max(5, originals * MAX_ORPHAN_SHARE)) return;
  for (const [name] of orphans) {
    if (name.startsWith("thumbs/")) await invoke("delete_media_thumb", { name: name.slice(7) });
    else await deleteMediaFile(name);
  }
}

function parseSkip(raw: string | null): string[] {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

class WorkerFailure extends Error {}

let running: Promise<OptimizeStats> | null = null;

export function optimizeMedia(): Promise<OptimizeStats> {
  running ??= (async () => {
    const stats: OptimizeStats = { files: 0, converted: 0, thumbs: 0, failed: 0, before: 0, after: 0 };
    const refs = await listAllMediaRefs();
    const thumbs = new Set(await invoke<string[]>("list_media_thumbs"));
    const skip = new Set<string>(parseSkip(await getSetting(SKIP_KEY)));
    const byPath = new Map<string, MediaRef[]>();
    for (const ref of refs) {
      if (thumbs.has(thumbName(ref.path)) || skip.has(ref.path)) continue;
      byPath.set(ref.path, [...(byPath.get(ref.path) ?? []), ref]);
    }
    stats.files = byPath.size;

    if (byPath.size) {
      const replaced = [...byPath.keys()].filter((p) => !p.endsWith(".webp"));
      if (replaced.length) {
        const dir = await invoke<string>("snapshot_media", { names: replaced });
        await snapshotDatabase(await join(dir, `timeline-${Date.now()}.db`));
      }

      const failed: string[] = [];
      await runLimited([...byPath], PARALLEL, async ([path, list]) => {
        try {
          await processFile(path, list, stats);
        } catch (e) {
          stats.failed++;
          if (!(e instanceof WorkerFailure)) failed.push(path);
          if (import.meta.env.DEV) console.warn("[media]", path, e);
        }
      });
      if (failed.length) await setSetting(SKIP_KEY, JSON.stringify([...skip, ...failed]));
      if (stats.converted || stats.thumbs) bumpDataVersion();
    }

    await sweepOrphans().catch(() => undefined);
    return stats;
  })().finally(() => {
    running = null;
  });
  return running;
}

const WARM_BATCH = 8;
const warm: HTMLImageElement[] = [];

export async function warmThumbs(): Promise<void> {
  const refs = await listAllMediaRefs();
  warm.length = 0;
  for (let i = 0; i < refs.length; i += WARM_BATCH) {
    await Promise.all(
      refs.slice(i, i + WARM_BATCH).map(({ path }) => {
        const img = new Image();
        img.src = thumbSrc(path);
        warm.push(img);
        return img.decode().catch(() => undefined);
      }),
    );
  }
}
