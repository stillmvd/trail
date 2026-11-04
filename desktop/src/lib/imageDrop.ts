import { fetch as httpFetch } from "@tauri-apps/plugin-http";

const IMAGE_TYPE = /^image\/(jpeg|png|webp|gif|avif|bmp)$/;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;
const MAX_BYTES = 30 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const LOCAL_HOST = /^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

export function carriesImage(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  const files = Array.from(dt.items).filter((it) => it.kind === "file");
  if (files.some((it) => IMAGE_TYPE.test(it.type))) return true;
  if (files.some((it) => it.type !== "")) return false;
  const types = Array.from(dt.types);
  return types.includes("text/uri-list") || types.includes("text/html");
}

function fileFrom(dt: DataTransfer): File | null {
  for (const file of Array.from(dt.files)) if (IMAGE_TYPE.test(file.type)) return file;
  for (const item of Array.from(dt.items)) {
    if (item.kind !== "file" || !IMAGE_TYPE.test(item.type)) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

function imageInHtml(html: string): string | null {
  const match = /<img\b[^>]*?\ssrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(html);
  const src = (match?.[1] ?? match?.[2] ?? "").trim().replace(/&amp;/g, "&");
  return /^(https?:\/\/\S+|data:image\/)/i.test(src) ? src : null;
}

function firstUrl(dt: DataTransfer): string | null {
  const line = (dt.getData("text/uri-list") || dt.getData("text/plain"))
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"));
  return line && /^https?:\/\/\S+$/i.test(line) ? line : null;
}

async function download(url: string): Promise<File> {
  if (!url.startsWith("data:") && LOCAL_HOST.test(new URL(url).host)) throw new Error("локальные адреса не загружаются");
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = url.startsWith("data:")
      ? await window.fetch(url)
      : await httpFetch(url, { headers: { Origin: "" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`сервер ответил ${res.status}`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) throw new Error("картинка больше 30 МБ");
    const blob = await res.blob();
    if (blob.size > MAX_BYTES) throw new Error("картинка больше 30 МБ");
    const type = (blob.type || res.headers.get("content-type") || "").split(";")[0].trim();
    if (!IMAGE_TYPE.test(type)) throw new Error("по ссылке не картинка");
    return new File([blob], "drop", { type });
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error("сервер не ответил за 20 секунд");
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function imageFromDrop(dt: DataTransfer): Promise<File | null> {
  const file = fileFrom(dt);
  if (file) return file;
  const fromHtml = imageInHtml(dt.getData("text/html"));
  const url = firstUrl(dt);
  if (fromHtml) return download(fromHtml);
  if (url && IMAGE_EXT.test(url.split(/[?#]/)[0])) return download(url);
  return null;
}
