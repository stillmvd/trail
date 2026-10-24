import { invoke } from "@tauri-apps/api/core";
import { setPreview } from "@/db/queries/digestItems";
import { settleLimited } from "./limit";
import { encodeImage } from "@/lib/media";
import { download, pageText } from "./sources";

const PAGE_TIMEOUT_MS = 8_000;
const IMAGE_TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;
const PARALLEL_PREVIEWS = 3;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export type PreviewTarget = { id: number; url: string; image_url: string | null; preview_file: string | null };

type Outcome = "saved" | "no-image" | "bad-image";

function ogImage(html: string, pageUrl: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta =
    doc.querySelector('meta[property="og:image"]') ??
    doc.querySelector('meta[name="og:image"]') ??
    doc.querySelector('meta[name="twitter:image"]') ??
    doc.querySelector('meta[property="twitter:image"]');
  const content = meta?.getAttribute("content");
  if (!content) return null;
  try {
    return new URL(content, pageUrl).href;
  } catch {
    return null;
  }
}

async function fetchPreview(target: PreviewTarget): Promise<Outcome> {
  const imageUrl = target.image_url || ogImage(await pageText(target.url, PAGE_TIMEOUT_MS), target.url);
  if (!imageUrl?.startsWith("https://")) return "no-image";
  const { bytes, type } = await download(imageUrl, IMAGE_TIMEOUT_MS);
  const ext = EXT[type.split(";")[0].trim().toLowerCase()];
  if (!ext || bytes.length === 0 || bytes.length > MAX_BYTES) return "bad-image";
  let data: Blob = new Blob([bytes], { type });
  let fileExt = ext;
  if (ext !== "gif") {
    const r = await encodeImage(data, true);
    if (!r.error && r.thumb && r.thumb.size < data.size) {
      data = r.thumb;
      fileExt = "webp";
    }
  }
  const name = await invoke<string>("save_digest_preview", new Uint8Array(await data.arrayBuffer()), {
    headers: { name: `${target.id}.${fileExt}` },
  });
  await setPreview(target.id, name);
  return "saved";
}

export async function fetchPreviews(targets: PreviewTarget[]): Promise<void> {
  const todo = targets.filter((t) => !t.preview_file);
  const results = await settleLimited(
    todo.map((t) => () => fetchPreview(t)),
    PARALLEL_PREVIEWS,
  );
  if (import.meta.env.DEV) {
    const tally: Record<string, number> = {};
    const errors: string[] = [];
    results.forEach((r, i) => {
      const key = r.status === "fulfilled" ? r.value : "error";
      tally[key] = (tally[key] ?? 0) + 1;
      if (r.status === "rejected") errors.push(`${todo[i].id}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    });
    console.info(`[digest] превью: целей ${todo.length}, ${JSON.stringify(tally)}${errors.length ? `, ошибки: ${errors.join("; ")}` : ""}`);
  }
}
