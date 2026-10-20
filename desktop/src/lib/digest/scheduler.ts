import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { format } from "date-fns";
import { getSetting } from "@/db/queries/settings";
import { getDigestByDate } from "@/db/queries/digests";
import { todayISO } from "../dates";
import { modeStore } from "../mode";
import { loadDigestConfig, STATE_KEYS } from "./config";
import { collectDigest, isCollecting, refreshUnseen } from "./collect";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RETRY_AFTER_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 3;

async function isDue(): Promise<boolean> {
  if (isCollecting()) return false;
  const today = todayISO();
  if (await getDigestByDate(today)) return false;
  const { time } = await loadDigestConfig();
  if (format(new Date(), "HH:mm") < time) return false;
  if ((await getSetting(STATE_KEYS.attemptsDate)) === today) {
    if (Number((await getSetting(STATE_KEYS.attemptsCount)) ?? 0) >= MAX_ATTEMPTS) return false;
  }
  if (await getSetting(STATE_KEYS.lastError)) {
    const last = Date.parse((await getSetting(STATE_KEYS.lastAttemptAt)) ?? "");
    if (!Number.isNaN(last) && Date.now() - last < RETRY_AFTER_MS) return false;
  }
  return true;
}

async function tick(): Promise<void> {
  if (await isDue()) await collectDigest({ manual: false });
}

export function useDigestScheduler() {
  useEffect(() => {
    refreshUnseen().catch(() => {});
    tick().catch(() => {});
    const timer = setInterval(() => {
      tick().catch(() => {});
    }, CHECK_INTERVAL_MS);
    const unlisten = listen("open-digest", () => modeStore.set("digest"));
    if (import.meta.env.DEV) {
      (window as unknown as { __digestCollect: () => unknown }).__digestCollect = () =>
        collectDigest({ manual: true });
    }
    return () => {
      clearInterval(timer);
      unlisten.then((f) => f());
    };
  }, []);
}
