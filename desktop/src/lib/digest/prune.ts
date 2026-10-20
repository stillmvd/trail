import { invoke } from "@tauri-apps/api/core";
import { expirePreviewsBefore, previewFiles, pruneItemsBefore } from "@/db/queries/digestItems";
import { pruneDigestsBefore } from "@/db/queries/digests";
import type { DigestConfig } from "./config";

const DAY_MS = 86_400_000;

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

export async function pruneDigest(config: DigestConfig): Promise<void> {
  await pruneDigestsBefore(daysAgo(config.keepDigestsDays));
  await pruneItemsBefore(daysAgo(config.keepCandidatesDays));
  await expirePreviewsBefore(daysAgo(config.keepPreviewsDays));
  const known = new Set(await previewFiles());
  const orphans = (await invoke<string[]>("list_digest_previews")).filter((name) => !known.has(name));
  if (orphans.length > 0) await invoke("prune_digest_previews", { names: orphans });
}
