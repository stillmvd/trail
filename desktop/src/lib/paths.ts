import { appDataDir, join } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";

let mediaDir: string | null = null;
let previewDir: string | null = null;

export async function initPaths(): Promise<void> {
  const base = await appDataDir();
  mediaDir = await join(base, "media");
  previewDir = await join(base, "digest-cache");
}

export function mediaSrc(relPath: string): string {
  if (!mediaDir) return "";
  return convertFileSrc(`${mediaDir}\\${relPath}`);
}

export function previewSrc(name: string): string {
  if (!previewDir) return "";
  return convertFileSrc(`${previewDir}\\${name}`);
}
