import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";

let mediaDir: string | null = null;

export async function initPaths(): Promise<void> {
  const base = await appDataDir();
  mediaDir = await join(base, "media");
}

export const thumbName = (relPath: string) => `${relPath.replace(/\.[^.]+$/, "")}.webp`;

export function mediaSrc(relPath: string): string {
  if (!mediaDir) return "";
  return convertFileSrc(`${mediaDir}\\${relPath}`);
}

export function thumbSrc(relPath: string): string {
  if (!mediaDir) return "";
  return convertFileSrc(`${mediaDir}\\thumbs\\${thumbName(relPath)}`);
}
