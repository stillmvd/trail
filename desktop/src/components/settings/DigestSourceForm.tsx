import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import type { DigestSource, DigestSourceKind } from "@/db/queries/digestSources";

export type DigestSourcePayload = {
  kind: DigestSourceKind;
  value: string;
  title: string | null;
  encoding: string | null;
  enabled: boolean;
};

const KINDS: { value: Exclude<DigestSourceKind, "hn">; label: string }[] = [
  { value: "rss", label: "Лента" },
  { value: "reddit", label: "Reddit" },
  { value: "github", label: "GitHub" },
];

function normalize(kind: DigestSourceKind, raw: string): string | null {
  const v = raw.trim();
  if (kind === "rss") return /^https?:\/\/\S+$/.test(v) ? v : null;
  if (kind === "reddit") {
    const sub = v.replace(/^(https?:\/\/(www\.)?reddit\.com)?\/?r\//i, "").replace(/\/.*$/, "");
    return /^[A-Za-z0-9_]{2,21}$/.test(sub) ? sub : null;
  }
  if (kind === "github") {
    const repo = v.replace(/^https?:\/\/github\.com\//i, "").replace(/\/+$/, "");
    return /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : null;
  }
  return v;
}

const VALUE_LABEL: Record<DigestSourceKind, string> = {
  rss: "Адрес ленты",
  reddit: "Сабреддит",
  github: "Репозиторий",
  hn: "",
};

const VALUE_HINT: Record<DigestSourceKind, string> = {
  rss: "https://habr.com/ru/rss/articles/",
  reddit: "ClaudeAI",
  github: "anthropics/claude-code",
  hn: "",
};

const VALUE_ERROR: Record<DigestSourceKind, string> = {
  rss: "Нужен адрес, начинающийся с http:// или https://",
  reddit: "Имя сабреддита — латиница, цифры и _",
  github: "Формат: владелец/репозиторий",
  hn: "",
};

export function DigestSourceForm({
  source,
  onSubmit,
  onDelete,
  onCancel,
}: {
  source: DigestSource | null;
  onSubmit: (payload: DigestSourcePayload) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<DigestSourceKind>(source?.kind ?? "rss");
  const [value, setValue] = useState(source?.value ?? "");
  const [title, setTitle] = useState(source?.title ?? "");
  const [encoding, setEncoding] = useState(source?.encoding ?? "");
  const [enabled, setEnabled] = useState(source ? source.enabled === 1 : true);
  const [error, setError] = useState<string | undefined>();

  function submit(e: FormEvent) {
    e.preventDefault();
    const normalized = normalize(kind, value);
    if (normalized === null) return setError(VALUE_ERROR[kind]);
    onSubmit({
      kind,
      value: normalized,
      title: kind === "rss" ? title.trim() || null : null,
      encoding: kind === "rss" ? encoding.trim() || null : null,
      enabled,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {!source && <SegmentedControl segments={KINDS} value={kind as Exclude<DigestSourceKind, "hn">} onChange={setKind} />}
      {kind !== "hn" && (
        <Input
          label={VALUE_LABEL[kind]}
          value={value}
          onChange={(v) => {
            setValue(v);
            setError(undefined);
          }}
          placeholder={VALUE_HINT[kind]}
          error={error}
          autoFocus
        />
      )}
      {kind === "rss" && (
        <div className="grid grid-cols-[1fr_160px] gap-3">
          <Input label="Название" value={title} onChange={setTitle} placeholder="по адресу" />
          <Input label="Кодировка" value={encoding} onChange={setEncoding} placeholder="utf-8" />
        </div>
      )}
      {source && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-[15px] font-medium text-app-text">Собирать из источника</span>
          <Switch checked={enabled} onChange={setEnabled} label="Собирать из источника" />
        </div>
      )}
      <div className="flex items-center gap-2">
        {source && source.kind !== "hn" && (
          <Button variant="danger" onClick={onDelete}>
            Удалить
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit">{source ? "Сохранить" : "Добавить"}</Button>
      </div>
    </form>
  );
}
