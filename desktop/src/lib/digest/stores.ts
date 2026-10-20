import { createLocalStore, createMemoryStore } from "../localStore";

export const DEFAULT_DIGEST_MODEL = "google/gemini-2.5-flash";

export const digestModelStore = createLocalStore<string>("trail.digest.model", DEFAULT_DIGEST_MODEL);
export const notifyDigestStore = createLocalStore<"1" | "0">("trail.notifyDigest", "1");

export const digestUnseenStore = createMemoryStore<boolean>(false);

export type DigestRun = { state: "idle" | "running" } | { state: "error"; message: string };
export const digestRunStore = createMemoryStore<DigestRun>({ state: "idle" });

export const digestVersionStore = createMemoryStore<number>(0);

export function bumpDigestVersion() {
  digestVersionStore.set(digestVersionStore.get() + 1);
}
