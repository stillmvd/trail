import { invoke } from "@tauri-apps/api/core";
import { thumbName } from "./paths";
import type { EncodeRequest, EncodeResult } from "./imageWorker";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function filterAcceptedImages(list: FileList | File[]): File[] {
  return Array.from(list).filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
}

const POOL_SIZE = 2;
let pool: Worker[] = [];
let seq = 0;
const pending = new Map<number, (r: EncodeResult) => void>();

function workers(): Worker[] {
  if (pool.length) return pool;
  pool = Array.from({ length: POOL_SIZE }, () => {
    const w = new Worker(new URL("./imageWorker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<EncodeResult>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
    w.onerror = () => {
      pool.forEach((x) => x.terminate());
      pool = [];
      for (const [id, resolve] of pending) resolve({ id, full: null, thumb: null, width: 0, height: 0, psnr: null, error: "worker" });
      pending.clear();
    };
    return w;
  });
  return pool;
}

export function encodeImage(blob: Blob, thumbOnly = false): Promise<EncodeResult> {
  const id = ++seq;
  const ws = workers();
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws[id % ws.length].postMessage({ id, blob, thumbOnly } satisfies EncodeRequest);
  });
}

export async function putMedia(name: string, data: Blob, thumb = false): Promise<void> {
  await invoke("save_media", new Uint8Array(await data.arrayBuffer()), {
    headers: thumb ? { name, thumb: "1" } : { name },
  });
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const extOf = (file: File) => EXT[file.type] ?? "jpg";

export async function writeMediaFile(file: File): Promise<string> {
  const uuid = crypto.randomUUID();
  const r = await encodeImage(file);
  if (r.error) {
    const name = `${uuid}.${extOf(file)}`;
    await putMedia(name, file);
    return name;
  }
  const name = r.full ? `${uuid}.webp` : `${uuid}.${extOf(file)}`;
  await putMedia(name, r.full ?? file);
  if (r.thumb) await putMedia(thumbName(name), r.thumb, true);
  return name;
}

export async function deleteMediaFile(relPath: string): Promise<void> {
  await invoke("delete_media", { name: relPath });
}
