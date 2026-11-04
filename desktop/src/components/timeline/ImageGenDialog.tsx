import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Brush, ChevronDown, CircleAlert, ImageIcon, LoaderCircle, Power, RotateCcw, Sparkles, Zap } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { tooltip } from "@/components/ui/Tooltip";
import { useQuery } from "@/lib/useQuery";
import {
  IMAGE_STYLES,
  comfyState,
  describeScene,
  imageProviderStore,
  imageStyleStore,
  loadImageProfile,
  releaseImageModels,
  renderImage,
  startComfy,
  stopComfy,
  type EngineState,
} from "@/lib/imageGen";
import { windowFocused, winToast } from "@/lib/notifications";

const PREVIEWS = import.meta.glob<string>("@/assets/imagegen/*.webp", { eager: true, import: "default" });
const preview = (id: string) => Object.entries(PREVIEWS).find(([path]) => path.endsWith(`/${id}.webp`))?.[1];

const SPRING = { type: "spring", bounce: 0, duration: 0.3 } as const;
const SWAP = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
  transition: SPRING,
};

const loadEngine = async (): Promise<EngineState | null> =>
  imageProviderStore.get() === "comfyui" ? comfyState() : null;

async function announce(title: string, body: string) {
  if (await windowFocused()) return;
  await winToast("imagegen", 0, title, body);
}

interface Attempt {
  file: File;
  url: string;
  styleId: string;
  scene: string;
}

export interface ImageGenSubject {
  title: string;
  note: string;
  category: string;
  currentSrc: string | null;
}

type StatusView = { icon: typeof Power; text: string; tone: "idle" | "work" | "err"; pulse?: boolean };

function statusView(engine: EngineState | "starting" | null | undefined, busy: string | null): StatusView {
  if (busy) return { icon: Brush, text: busy, tone: "work", pulse: true };
  if (engine === "ready") return { icon: Zap, text: "ComfyUI готов", tone: "work" };
  if (engine === "starting") return { icon: LoaderCircle, text: "ComfyUI запускается…", tone: "work", pulse: true };
  if (engine === "remote") return { icon: CircleAlert, text: "ComfyUI не отвечает", tone: "err" };
  if (engine === "off") return { icon: Power, text: "Запустить ComfyUI", tone: "idle" };
  return { icon: LoaderCircle, text: "Проверка ComfyUI…", tone: "idle", pulse: true };
}

const TONE = { idle: "var(--rg-muted)", work: "var(--ds-accent-ink)", err: "var(--rg-rust)" };

const CONFIRM_MS = 6000;
const CAPSULE =
  "h-8 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96]";

function ComfyStatus({
  engine,
  busy,
  onLaunch,
  onStop,
}: {
  engine: EngineState | "starting" | null | undefined;
  busy: string | null;
  onLaunch: () => void;
  onStop: () => Promise<void>;
}) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "stopping">("idle");

  useEffect(() => {
    if (phase !== "confirm") return;
    const id = window.setTimeout(() => setPhase("idle"), CONFIRM_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  async function stop() {
    setPhase("stopping");
    try {
      await onStop();
    } finally {
      setPhase("idle");
    }
  }

  const view: StatusView =
    phase === "stopping"
      ? { icon: LoaderCircle, text: "ComfyUI останавливается…", tone: "idle", pulse: true }
      : phase === "confirm"
        ? { icon: Power, text: "Остановить ComfyUI?", tone: "idle" }
        : statusView(engine, busy);
  const launch = engine === "off" && !busy && phase === "idle";
  const stoppable = engine === "ready" && !busy && phase === "idle";
  const Icon = view.icon;
  const spin = view.icon === LoaderCircle;
  const body = (
    <>
      <span
        aria-hidden
        className={`comfy-dots ${view.pulse ? "comfy-dots-pulse" : ""}`}
        style={{ "--tone": TONE[view.tone] } as React.CSSProperties}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={phase} className="relative flex flex-col items-center gap-2.5" {...SWAP}>
          <span
            className={`grid h-12 w-12 place-items-center rounded-full ${launch ? "bg-amber text-ink" : ""}`}
            style={launch ? undefined : { background: `color-mix(in oklch, ${TONE[view.tone]} 22%, var(--ds-surface-1))`, color: TONE[view.tone] }}
          >
            <Icon size={22} strokeWidth={1.75} className={spin ? "animate-spin" : undefined} />
          </span>
          {phase === "confirm" ? (
            <span className="flex items-center gap-1.5">
              <button type="button" onClick={stop} className={`${CAPSULE} bg-amber text-ink`}>
                Остановить
              </button>
              <button type="button" onClick={() => setPhase("idle")} className={`${CAPSULE} bg-surface-3 text-app-text hover:bg-surface-active`}>
                Отмена
              </button>
            </span>
          ) : (
            <span className="text-[13px] font-semibold text-app-text">{view.text}</span>
          )}
        </motion.span>
      </AnimatePresence>
    </>
  );
  const shell = "relative grid h-[132px] shrink-0 place-items-center overflow-hidden rounded-3xl bg-surface-2";
  if (launch || stoppable) {
    return (
      <button
        type="button"
        onClick={launch ? onLaunch : () => setPhase("confirm")}
        {...(stoppable ? tooltip("Остановить ComfyUI", "bottom") : {})}
        className={`${shell} cursor-pointer transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 active:scale-[0.98]`}
      >
        {body}
      </button>
    );
  }
  return (
    <div role="status" className={shell}>
      {body}
    </div>
  );
}

type ApplyImage =(file: File) => Promise<boolean> | boolean | void;

export function ImageGenDialog({
  open,
  subject,
  applyLabel,
  onClose,
  onApply,
}: {
  open: boolean;
  subject: ImageGenSubject;
  applyLabel?: string;
  onClose: () => void;
  onApply: ApplyImage;
}) {
  const dirty = useRef(false);
  const canDismiss = useCallback(() => !dirty.current, []);

  return (
    <Dialog open={open} onClose={onClose} canDismiss={canDismiss} escapeCapture title="Картинка для события" width={960} zIndex={95}>
      {open && (
        <ImageGenBody subject={subject} applyLabel={applyLabel} dirtyRef={dirty} onClose={onClose} onApply={onApply} />
      )}
    </Dialog>
  );
}

function ImageGenBody({
  subject,
  applyLabel,
  dirtyRef,
  onClose,
  onApply,
}: {
  subject: ImageGenSubject;
  applyLabel?: string;
  dirtyRef: RefObject<boolean>;
  onClose: () => void;
  onApply: ApplyImage;
}) {
  const styleId = imageStyleStore.use();
  const provider = imageProviderStore.use();
  const [hint, setHint] = useState("");
  const profile = useQuery(loadImageProfile).data;
  const checked = useQuery(loadEngine, { key: `imagegen-engine:${provider}` });
  const [starting, setStarting] = useState(false);
  const engine: EngineState | "starting" | null = starting ? "starting" : checked.data;
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selected, setSelected] = useState(-1);
  const [busy, setBusy] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sceneOpen, setSceneOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const sceneCache = useRef<{ key: string; text: string } | null>(null);
  const urls = useRef<string[]>([]);
  const alive = useRef(true);
  const dirty = hint.trim() !== "" || attempts.length > 0 || busy !== null || starting || applying;

  useEffect(() => {
    dirtyRef.current = dirty;
  });

  useEffect(() => {
    const list = urls.current;
    alive.current = true;
    return () => {
      alive.current = false;
      dirtyRef.current = false;
      list.forEach((u) => URL.revokeObjectURL(u));
      void releaseImageModels();
    };
  }, [dirtyRef]);

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [busy]);

  async function launch() {
    setStarting(true);
    try {
      await startComfy();
      void announce("ComfyUI запущен", "Можно рисовать картинку");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      void announce("ComfyUI не запустился", message);
    } finally {
      setStarting(false);
      checked.reload();
    }
  }

  async function halt() {
    try {
      await stopComfy();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      checked.reload();
    }
  }

  async function generate() {
    setError(null);
    setStartedAt(Date.now());
    setNow(Date.now());
    try {
      const input = { title: subject.title, note: subject.note, category: subject.category, hint, profile: profile ?? "" };
      const key = JSON.stringify(input);
      const style = imageStyleStore.get();
      const last = attempts[attempts.length - 1];
      const styleOnly = sceneCache.current?.key === key && last !== undefined && last.styleId !== style;
      let scene = styleOnly ? sceneCache.current!.text : null;
      if (!scene) {
        setBusy("Пишу сцену");
        scene = await describeScene(input);
        sceneCache.current = { key, text: scene };
      }
      setBusy("Рисую");
      const file = await renderImage(scene, style, (m) => setBusy(m));
      if (provider === "comfyui") checked.reload();
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      setAttempts([...attempts, { file, url, styleId: style, scene }]);
      setSelected(attempts.length);
      if (alive.current) void announce("Картинка готова", subject.title);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      if (alive.current) void announce("Картинка не получилась", message);
    } finally {
      setBusy(null);
    }
  }

  async function apply(file: File) {
    setApplying(true);
    try {
      if ((await onApply(file)) === false) return;
      dirtyRef.current = false;
      onClose();
    } finally {
      setApplying(false);
    }
  }

  const current = attempts[selected];
  const shown = current?.url ?? subject.currentSrc;
  const elapsed = busy ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[1fr_300px] gap-6">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="relative aspect-video overflow-hidden rounded-3xl bg-surface-2">
            <AnimatePresence initial={false}>
              {shown && (
                <motion.img
                  key={shown}
                  src={shown}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: busy ? 0.4 : 1 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING}
                />
              )}
            </AnimatePresence>
            {!current && subject.currentSrc && !busy && (
              <span className="absolute left-3 top-3 rounded-full bg-surface-1/80 px-3 py-1 text-xs font-medium text-app-text">Сейчас</span>
            )}
            <div className="absolute inset-0 grid place-items-center">
              <AnimatePresence mode="wait" initial={false}>
                {busy ? (
                  <motion.div
                    key="busy"
                    className="flex items-center gap-3 rounded-full bg-surface-1/90 px-5 py-3 text-sm font-medium text-app-text"
                    {...SWAP}
                  >
                    <LoaderCircle size={18} strokeWidth={1.75} className="animate-spin" />
                    {busy} · {elapsed} с
                  </motion.div>
                ) : (
                  !shown && (
                    <motion.div key="icon" className="text-muted" {...SWAP}>
                      <ImageIcon size={44} strokeWidth={1.5} />
                    </motion.div>
                  )
                )}
              </AnimatePresence>
            </div>
          </div>

          {current && (
            <button
              type="button"
              onClick={() => setSceneOpen(!sceneOpen)}
              className="flex cursor-pointer items-start gap-2 text-left text-[13px] leading-snug text-muted hover:text-app-text"
            >
              <ChevronDown size={16} strokeWidth={1.75} className={`mt-px shrink-0 transition-transform ${sceneOpen ? "" : "-rotate-90"}`} />
              <span className={sceneOpen ? "" : "line-clamp-1"}>Сцена: {current.scene}</span>
            </button>
          )}

          {error && <p className="text-sm text-rust">{error}</p>}
        </div>

        <div className="flex flex-col gap-5">
          {attempts.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted">Варианты</span>
              <div className="grid grid-cols-3 gap-1.5">
                {attempts.map((a, i) => (
                  <button
                    key={a.url}
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-label={`Вариант ${i + 1}`}
                    className={`cursor-pointer rounded-xl p-1 transition-[background-color,opacity,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
                      i === selected ? "bg-surface-active" : "opacity-60 hover:bg-surface-2 hover:opacity-100"
                    }`}
                  >
                    <img src={a.url} alt="" className="aspect-video w-full rounded-lg object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <Textarea
            label="Уточнение"
            value={hint}
            onChange={setHint}
            rows={2}
            fill
            placeholder="Например: мы вдвоём, Настя на соседней доске"
          />

          {provider === "comfyui" && (
            <ComfyStatus engine={engine} busy={busy ? `${busy} · ${elapsed} с` : null} onLaunch={launch} onStop={halt} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {IMAGE_STYLES.map((s) => {
          const src = preview(s.id);
          const on = s.id === styleId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => imageStyleStore.set(s.id)}
              aria-pressed={on}
              className={`flex cursor-pointer flex-col gap-1.5 rounded-2xl p-1.5 text-left transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
                on ? "bg-surface-active" : "bg-surface-2 hover:bg-surface-3"
              }`}
            >
              {src ? (
                <img src={src} alt="" className="aspect-video w-full rounded-xl object-cover" />
              ) : (
                <span className="aspect-video w-full rounded-xl bg-surface-3" />
              )}
              <span className={`px-1 pb-0.5 text-[13px] font-medium ${on ? "text-app-text" : "text-muted"}`}>{s.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <div className="flex gap-2">
          <Button
            variant={current ? "secondary" : "primary"}
            onClick={generate}
            disabled={!!busy || profile === null}
          >
            {current ? <RotateCcw size={16} strokeWidth={1.75} /> : <Sparkles size={16} strokeWidth={1.75} />}
            {current ? "Ещё вариант" : "Сгенерировать"}
          </Button>
          {current && (
            <Button onClick={() => apply(current.file)} disabled={!!busy || applying}>
              {applyLabel ?? (subject.currentSrc ? "Заменить фото" : "Готово")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
