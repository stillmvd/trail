import { useState } from "react";
import { format } from "date-fns";
import { ChevronRight, Flame, Github, MessageSquare, Plus, Rss, TriangleAlert, type LucideIcon } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { CapsHead, FUSED } from "@/components/digest/DigestRows";
import { useQuery } from "@/lib/useQuery";
import { pluralRu } from "@/lib/duration";
import { bumpDigestVersion, digestVersionStore } from "@/lib/digest/stores";
import {
  createSource,
  deleteSource,
  listSources,
  updateSource,
  type DigestSource,
  type DigestSourceKind,
} from "@/db/queries/digestSources";
import { DigestSourceForm, type DigestSourcePayload } from "./DigestSourceForm";

const FAINT = "text-[var(--ds-text-faint)]";
const ROUND = "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted";

const KINDS: { kind: DigestSourceKind; title: string; icon: LucideIcon }[] = [
  { kind: "rss", title: "Ленты", icon: Rss },
  { kind: "reddit", title: "Reddit", icon: MessageSquare },
  { kind: "hn", title: "Hacker News", icon: Flame },
  { kind: "github", title: "GitHub-релизы", icon: Github },
];

function sourceName(s: DigestSource): string {
  if (s.kind === "reddit") return `r/${s.value}`;
  if (s.kind === "hn") return "Hacker News";
  if (s.kind === "github") return s.value;
  return s.title || s.value.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
}

function sourceSub(s: DigestSource, hnMinPoints: number): string {
  if (s.kind === "reddit") return "топ дня";
  if (s.kind === "hn") return `от ${hnMinPoints} очков`;
  if (s.kind === "github") return "релизы";
  const url = s.value.replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");
  return s.encoding ? `${url} · ${s.encoding}` : url;
}

function failedAt(s: DigestSource): string {
  const d = s.last_error_at ? new Date(s.last_error_at) : null;
  return d && !Number.isNaN(d.getTime()) ? ` в ${format(d, "H:mm")}` : "";
}

type Edit = { source: DigestSource | null } | null;

export function DigestSourceManager({ hnMinPoints }: { hnMinPoints: number }) {
  const version = digestVersionStore.use();
  const { data } = useQuery(listSources, { rev: version });
  const { show } = useToast();
  const [edit, setEdit] = useState<Edit>(null);
  const [confirm, setConfirm] = useState<DigestSource | null>(null);

  const sources = data ?? [];
  const active = sources.filter((s) => s.enabled === 1);
  const failing = active.filter((s) => s.last_error);

  async function save(payload: DigestSourcePayload) {
    const current = edit?.source ?? null;
    const duplicate = sources.some((s) => s.id !== current?.id && s.kind === payload.kind && s.value === payload.value);
    if (duplicate) return show("Такой источник уже есть", "error");
    setEdit(null);
    try {
      if (current) await updateSource(current.id, payload);
      else await createSource(payload);
      bumpDigestVersion();
      show(current ? "Источник сохранён" : "Источник добавлен", "success");
    } catch (e) {
      show(String(e), "error");
    }
  }

  async function remove(source: DigestSource) {
    setEdit(null);
    try {
      await deleteSource(source.id);
      bumpDigestVersion();
      show("Источник удалён", "success");
    } catch (e) {
      show(String(e), "error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {failing.length > 0 && (
        <p className="flex items-center gap-2.5 rounded-3xl bg-surface-1 px-4 py-3 text-[13px] text-rust">
          <TriangleAlert size={16} strokeWidth={1.75} className="shrink-0" />
          <span className="min-w-0">
            {failing.length === 1 ? (
              <>
                <b className="font-semibold text-app-text">{sourceName(failing[0])}</b> · {failing[0].last_error}
                {failedAt(failing[0])}
              </>
            ) : (
              <>
                <b className="font-semibold text-app-text">
                  {failing.length} {pluralRu(failing.length, ["источник", "источника", "источников"])} со сбоем
                </b>{" "}
                · {failing.map(sourceName).join(", ")}
              </>
            )}
            {failing.length < active.length && ", остальные источники собрались"}
          </span>
        </p>
      )}

      {KINDS.map(({ kind, title, icon: Icon }) => {
        const list = sources.filter((s) => s.kind === kind);
        if (list.length === 0) return null;
        return (
          <section key={kind} className="flex flex-col gap-2">
            <CapsHead>{title}</CapsHead>
            <div className="flex flex-col gap-0.5">
              {list.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setEdit({ source: s })}
                  className={`flex min-h-[52px] w-full min-w-0 cursor-pointer items-center gap-3 bg-surface-1 px-4 py-2 text-left transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-2 active:scale-[0.96] ${FUSED}`}
                >
                  <Icon size={16} strokeWidth={1.75} className={`shrink-0 ${FAINT}`} />
                  <span className={`flex min-w-0 flex-1 flex-col leading-[1.25] ${s.enabled ? "" : "opacity-55"}`}>
                    <b className="truncate text-sm font-semibold text-app-text">{sourceName(s)}</b>
                    <span className={`truncate text-xs ${FAINT}`}>{sourceSub(s, hnMinPoints)}</span>
                  </span>
                  {!s.enabled ? (
                    <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-surface-2 px-3 text-[12.5px] font-semibold whitespace-nowrap text-muted">
                      выключен
                    </span>
                  ) : s.last_error ? (
                    <span
                      title={s.last_error}
                      className="inline-flex h-7 max-w-[220px] shrink-0 items-center truncate rounded-full bg-surface-2 px-3 text-[12.5px] font-semibold whitespace-nowrap text-rust"
                    >
                      <span className="truncate">{s.last_error}</span>
                    </span>
                  ) : (
                    s.last_ok_at && (
                      <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-surface-2 px-3 text-[12.5px] font-semibold whitespace-nowrap text-muted tabular-nums">
                        {s.last_count} за сбор
                      </span>
                    )
                  )}
                  <span className={ROUND}>
                    <ChevronRight size={15} strokeWidth={1.75} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <button
        type="button"
        onClick={() => setEdit({ source: null })}
        className="flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-3xl bg-surface-1 px-4 py-2 text-left transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-2 active:scale-[0.96]"
      >
        <span className={`flex-1 text-sm font-medium ${FAINT}`}>Добавить источник</span>
        <span className={ROUND}>
          <Plus size={15} strokeWidth={1.75} />
        </span>
      </button>

      <Dialog
        open={edit !== null}
        onClose={() => setEdit(null)}
        width={560}
        title={edit?.source ? sourceName(edit.source) : "Новый источник"}
      >
        {edit && (
          <DigestSourceForm
            key={edit.source?.id ?? "new"}
            source={edit.source}
            onSubmit={save}
            onDelete={() => edit.source && setConfirm(edit.source)}
            onCancel={() => setEdit(null)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        title="Удалить источник?"
        message={`«${confirm ? sourceName(confirm) : ""}» больше не будет участвовать в сборе. Уже собранные материалы останутся.`}
        onConfirm={() => confirm && remove(confirm)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
