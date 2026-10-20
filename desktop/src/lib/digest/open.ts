import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

export async function openArticle(url: string): Promise<void> {
  try {
    await invoke("open_in_chrome", { url });
  } catch {
    await openUrl(url);
  }
}
