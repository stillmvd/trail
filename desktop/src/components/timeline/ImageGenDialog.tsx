import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ImageIcon, LoaderCircle, Power, RotateCcw, Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
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
  sceneModelLabel,
  startComfy,
  type EngineState,
} from "@/lib/imageGen";

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

export function ImageGenDialog({
  open,
  subject,
  onClose,
  onApply,
}: {
  open: boolean;
  subject: ImageGenSubject;
  onClose: () => void;
  onApply: (file: File) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Картинка для события" width={960} zIndex={95}>
      {open && <ImageGenBody subject={subject} onClose={onClose} onApply={onApply} />}
    </Dialog>
  );
}

function ImageGenBody({
  subject,
  onClose,
  onApply,
}: {
  subject: ImageGenSubject;
  onClose: () => void;
  onApply: (file: File) => void;
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
  const sceneCache = useRef<{ key: string; text: string } | null>(null);
  const urls = useRef<string[]>([]);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    const list = urls.current;
    return () => {
      list.forEach((u) => URL.revokeObjectURL(u));
      void releaseImageModels();
    };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [busy]);

  async function launch() {
    setStarting(true);
    try {
      await startComfy();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
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
            placeholder="Например: мы вдвоём, Настя на соседней доске"
          />

          <div className="flex flex-col gap-1 text-[13px] text-muted">
            {provider === "comfyui" && (
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${engine === "ready" ? "bg-amber" : "bg-surface-3"}`} />
                  {engine === "ready"
                    ? "ComfyUI готов"
                    : engine === "starting"
                      ? "ComfyUI запускается…"
                      : engine === "remote"
                        ? "ComfyUI не отвечает"
                        : engine === "off"
                          ? "ComfyUI выключен"
                          : "Проверяю ComfyUI…"}
                </span>
                {engine === "off" && (
                  <button
                    type="button"
                    onClick={launch}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-app-text transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 active:scale-[0.96]"
                  >
                    <Power size={14} strokeWidth={1.75} />
                    Запустить
                  </button>
                )}
              </div>
            )}
            <span>Сцену пишет {sceneModelLabel()}</span>
          </div>
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
            <Button
              onClick={() => {
                onApply(current.file);
                onClose();
              }}
              disabled={!!busy}
            >
              {subject.currentSrc ? "Заменить фото" : "Готово"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
