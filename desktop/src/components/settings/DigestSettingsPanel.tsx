import { useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronRight, Eye, EyeOff, Newspaper } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { CapsHead, FUSED } from "@/components/digest/DigestRows";
import { openRouterKeyStore } from "@/lib/openrouter";
import { pluralRu } from "@/lib/duration";
import { saveDigestConfig, type DigestConfig } from "@/lib/digest/config";
import { bumpDigestVersion, DEFAULT_DIGEST_MODEL, digestModelStore, notifyDigestStore } from "@/lib/digest/stores";
import { DigestBansPanel } from "./DigestBansPanel";

const FAINT = "text-[var(--ds-text-faint)]";
const DAYS: [string, string, string] = ["день", "дня", "дней"];

type Commit = (raw: string) => unknown;

function editKeys(e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, original: string) {
  if (e.key === "Escape") {
    e.stopPropagation();
    e.currentTarget.value = original;
    e.currentTarget.blur();
  } else if (e.key === "Enter" && e.currentTarget.tagName === "INPUT") {
    e.currentTarget.blur();
  }
}

function commitOn(el: HTMLInputElement | HTMLTextAreaElement, original: string, commit: Commit) {
  const raw = el.value.trim();
  if (raw === original) return;
  if (commit(raw) === false) el.value = original;
}

function positive(max: number, save: (n: number) => void): Commit {
  return (raw) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > max) return false;
    save(n);
  };
}

async function patchConfig(patch: Partial<DigestConfig>) {
  await saveDigestConfig(patch);
  bumpDigestVersion();
}

function Tile({ value, label, suffix, onCommit }: { value: string; label: string; suffix?: string; onCommit: Commit }) {
  return (
    <label className="flex min-w-0 cursor-text flex-col gap-0.5 rounded-3xl bg-surface-1 px-4 py-3.5 transition-colors duration-150 ease-[var(--rg-ease)] hover:bg-surface-2">
      <span className="flex min-w-0 items-baseline gap-1">
        <input
          key={value}
          defaultValue={value}
          onKeyDown={(e) => editKeys(e, value)}
          onBlur={(e) => commitOn(e.currentTarget, value, onCommit)}
          className={`field-sizing-content max-w-full min-w-[1ch] bg-transparent leading-[1.1] font-bold tracking-[-0.02em] text-app-text tabular-nums outline-none ${
            value.length > 8 ? "text-[15px]" : "text-2xl"
          }`}
        />
        {suffix && <span className="text-[15px] font-bold text-muted">{suffix}</span>}
      </span>
      <span className={`text-xs ${FAINT}`}>{label}</span>
    </label>
  );
}

function ValueRow({ title, value, suffix, onCommit }: { title: string; value: string; suffix?: string; onCommit: Commit }) {
  return (
    <label className={`flex min-h-[52px] cursor-text items-center gap-3 bg-surface-1 px-4 py-2 transition-colors duration-150 ease-[var(--rg-ease)] hover:bg-surface-2 ${FUSED}`}>
      <b className="min-w-0 flex-1 truncate text-sm font-semibold text-app-text">{title}</b>
      <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-muted">
        <input
          key={value}
          defaultValue={value}
          onKeyDown={(e) => editKeys(e, value)}
          onBlur={(e) => commitOn(e.currentTarget, value, onCommit)}
          className="field-sizing-content min-w-[1ch] bg-transparent text-right text-muted tabular-nums outline-none focus:text-app-text"
        />
        {suffix}
        <ChevronRight size={16} strokeWidth={1.75} className={FAINT} />
      </span>
    </label>
  );
}

function Area({ label, value, placeholder, onCommit }: { label: string; value: string; placeholder: string; onCommit: Commit }) {
  return (
    <label className="flex cursor-text flex-col gap-1 rounded-3xl bg-surface-1 px-4 py-3.5">
      <span className={`text-xs font-semibold ${FAINT}`}>{label}</span>
      <textarea
        key={value}
        defaultValue={value}
        placeholder={placeholder}
        onKeyDown={(e) => editKeys(e, value)}
        onBlur={(e) => commitOn(e.currentTarget, value, onCommit)}
        className="field-sizing-content min-h-[3lh] resize-none bg-transparent text-[13.5px] leading-normal text-app-text outline-none placeholder:text-[var(--ds-text-faint)]"
      />
    </label>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-0.5">{children}</div>;
}

export function DigestPickTab({ config }: { config: DigestConfig }) {
  return (
    <div className="flex flex-col gap-2">
      <Area
        label="Интересы · по строке на тему"
        value={config.interests}
        placeholder="Фронтенд и TypeScript: React, сборка, инструменты"
        onCommit={(v) => patchConfig({ interests: v })}
      />
      <Area
        label="Не берём"
        value={config.avoid}
        placeholder="политика"
        onCommit={(v) => patchConfig({ avoid: v })}
      />
      <p className="mt-2 flex items-center gap-2.5 rounded-3xl bg-surface-1 px-4 py-3 text-[13px] text-muted">
        <Newspaper size={16} strokeWidth={1.75} className="shrink-0" />
        Темы групп в сводке — начало строки интереса, до двоеточия
      </p>
    </div>
  );
}

function maskKey(key: string) {
  return key.length > 13 ? `${key.slice(0, 9)}••••${key.slice(-4)}` : "••••";
}

function KeyRow() {
  const key = openRouterKeyStore.use().trim();
  const [shown, setShown] = useState(false);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className={`flex min-h-[52px] items-center gap-3 bg-surface-1 px-4 py-2 ${FUSED}`}>
        <b className="shrink-0 text-sm font-semibold text-app-text">Ключ OpenRouter</b>
        <input
          autoFocus
          defaultValue={key}
          placeholder="sk-or-v1-…"
          onKeyDown={(e) => {
            editKeys(e, key);
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={(e) => {
            openRouterKeyStore.set(e.currentTarget.value.trim());
            setEditing(false);
            bumpDigestVersion();
          }}
          className="min-w-0 flex-1 bg-transparent text-right text-sm text-app-text outline-none placeholder:text-muted"
        />
      </div>
    );
  }

  return (
    <div className={`flex min-h-[52px] items-center gap-3 bg-surface-1 px-4 py-2 ${FUSED}`}>
      <button type="button" onClick={() => setEditing(true)} className="flex min-w-0 flex-1 cursor-pointer flex-col text-left leading-[1.25]">
        <b className="truncate text-sm font-semibold text-app-text">Ключ OpenRouter</b>
        <span className={`truncate text-xs ${key ? FAINT : "text-rust"}`}>
          {key ? (shown ? key : maskKey(key)) : "не задан — сводка не собирается"}
        </span>
      </button>
      {key ? (
        <button
          type="button"
          aria-label={shown ? "Скрыть ключ" : "Показать ключ"}
          title={shown ? "Скрыть ключ" : "Показать ключ"}
          onClick={() => setShown((v) => !v)}
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-2 text-muted transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] hover:text-app-text active:scale-[0.96]"
        >
          {shown ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full bg-amber px-4 text-[13px] font-bold text-ink transition-[scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96]"
        >
          Вставить ключ
        </button>
      )}
    </div>
  );
}

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function DigestRunTab({ config }: { config: DigestConfig }) {
  const model = digestModelStore.use();
  const notify = notifyDigestStore.use() === "1";
  const setModel: Commit = (v) => digestModelStore.set(v || DEFAULT_DIGEST_MODEL);
  const days = (n: number) => pluralRu(n, DAYS);

  return (
    <div className="flex flex-col gap-4">
      <Rows>
        <KeyRow />
        <ValueRow title="Модель отбора" value={model} onCommit={setModel} />
      </Rows>

      <div className="grid grid-cols-3 gap-2">
        <Tile value={String(config.maxItems)} label="материалов в выпуске" onCommit={positive(50, (n) => patchConfig({ maxItems: n }))} />
        <Tile value={String(config.windowHours)} suffix="ч" label="окно свежести" onCommit={positive(168, (n) => patchConfig({ windowHours: n }))} />
        <Tile value={String(config.hnMinPoints)} label="порог Hacker News" onCommit={positive(5000, (n) => patchConfig({ hnMinPoints: n }))} />
        <Tile value={String(config.redditTake)} label="из топа Reddit" onCommit={positive(200, (n) => patchConfig({ redditTake: n }))} />
        <Tile
          value={config.time}
          label="время сбора"
          onCommit={(raw) => {
            const m = HHMM.exec(raw);
            if (!m) return false;
            patchConfig({ time: `${m[1].padStart(2, "0")}:${m[2]}` });
          }}
        />
        <Tile value={model} label="модель" onCommit={setModel} />
      </div>

      <div className="flex flex-col gap-2">
        <CapsHead>Сколько хранить</CapsHead>
        <Rows>
          <ValueRow title="Сводки" value={String(config.keepDigestsDays)} suffix={days(config.keepDigestsDays)} onCommit={positive(3650, (n) => patchConfig({ keepDigestsDays: n }))} />
          <ValueRow title="Кандидаты" value={String(config.keepCandidatesDays)} suffix={days(config.keepCandidatesDays)} onCommit={positive(3650, (n) => patchConfig({ keepCandidatesDays: n }))} />
          <ValueRow title="Превью" value={String(config.keepPreviewsDays)} suffix={days(config.keepPreviewsDays)} onCommit={positive(3650, (n) => patchConfig({ keepPreviewsDays: n }))} />
        </Rows>
      </div>

      <Rows>
        <div className={`flex min-h-[52px] items-center gap-3 bg-surface-1 px-4 py-2 ${FUSED}`}>
          <b className="min-w-0 flex-1 truncate text-sm font-semibold text-app-text">Уведомлять о готовой сводке</b>
          <Switch checked={notify} onChange={(v) => notifyDigestStore.set(v ? "1" : "0")} label="Уведомлять о готовой сводке" />
        </div>
      </Rows>

      <DigestBansPanel />
    </div>
  );
}
