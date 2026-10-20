import { fetch } from "@tauri-apps/plugin-http";
import { createLocalStore } from "./localStore";

export const openRouterKeyStore = createLocalStore<string>("trail.imagegen.openRouterKey", "");

export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function postJson(url: string, token: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiError(new URL(url).hostname, res.status, json));
  return json;
}

export function apiError(source: string, status: number, json: unknown) {
  const j = json as { error?: { message?: string }; errors?: { message?: string }[] } | null;
  const message = j?.error?.message ?? j?.errors?.[0]?.message;
  return `${source}: ${message ?? `ошибка ${status}`}`;
}
