import { getSetting, setSetting } from "@/db/queries/settings";

export type DigestConfig = {
  interests: string;
  avoid: string;
  maxItems: number;
  windowHours: number;
  hnMinPoints: number;
  redditTake: number;
  time: string;
  keepDigestsDays: number;
  keepCandidatesDays: number;
  keepPreviewsDays: number;
};

const KEYS: { [K in keyof DigestConfig]: string } = {
  interests: "digest_interests",
  avoid: "digest_avoid",
  maxItems: "digest_max_items",
  windowHours: "digest_window_hours",
  hnMinPoints: "digest_hn_min_points",
  redditTake: "digest_reddit_take",
  time: "digest_time",
  keepDigestsDays: "digest_keep_digests_days",
  keepCandidatesDays: "digest_keep_candidates_days",
  keepPreviewsDays: "digest_keep_previews_days",
};

export const DEFAULT_DIGEST_CONFIG: DigestConfig = {
  interests: "",
  avoid: "",
  maxItems: 12,
  windowHours: 26,
  hnMinPoints: 150,
  redditTake: 30,
  time: "09:00",
  keepDigestsDays: 365,
  keepCandidatesDays: 60,
  keepPreviewsDays: 90,
};

export async function loadDigestConfig(): Promise<DigestConfig> {
  const entries = await Promise.all(
    (Object.keys(KEYS) as (keyof DigestConfig)[]).map(async (field) => {
      const raw = await getSetting(KEYS[field]);
      const fallback = DEFAULT_DIGEST_CONFIG[field];
      if (raw === null) return [field, fallback] as const;
      if (typeof fallback === "number") {
        const n = Number(raw);
        return [field, Number.isFinite(n) && n > 0 ? n : fallback] as const;
      }
      return [field, raw] as const;
    }),
  );
  return Object.fromEntries(entries) as DigestConfig;
}

export async function saveDigestConfig(patch: Partial<DigestConfig>): Promise<void> {
  for (const [field, value] of Object.entries(patch) as [keyof DigestConfig, string | number][]) {
    await setSetting(KEYS[field], String(value));
  }
}

export const STATE_KEYS = {
  lastAttemptAt: "digest_last_attempt_at",
  lastError: "digest_last_error",
  lastSuccessAt: "digest_last_success_at",
  attemptsDate: "digest_attempts_date",
  attemptsCount: "digest_attempts_count",
  seeded: "digest_seeded",
} as const;
