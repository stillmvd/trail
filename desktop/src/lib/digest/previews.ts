import { invoke } from "@tauri-apps/api/core";
import { setPreview } from "@/db/queries/digestItems";
import { download, pageText } from "./sources";

const PAGE_TIMEOUT_MS = 8_000;
const IMAGE_TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export type PreviewTarget = { id: number; url: string; image_url: string | null; preview_file: string | null };

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

async function fetchPreview(target: PreviewTarget): Promise<void> {
  const imageUrl = target.image_url || ogImage(await pageText(target.url, PAGE_TIMEOUT_MS), target.url);
  if (!imageUrl?.startsWith("https://")) return;
  const { bytes, type } = await download(imageUrl, IMAGE_TIMEOUT_MS);
  const ext = EXT[type.split(";")[0].trim().toLowerCase()];
  if (!ext || bytes.length === 0 || bytes.length > MAX_BYTES) return;
  const name = await invoke<string>("save_digest_preview", {
    name: `${target.id}.${ext}`,
    data: Array.from(bytes),
  });
  await setPreview(target.id, name);
}

export async function fetchPreviews(targets: PreviewTarget[]): Promise<void> {
  await Promise.allSettled(targets.filter((t) => !t.preview_file).map(fetchPreview));
}
