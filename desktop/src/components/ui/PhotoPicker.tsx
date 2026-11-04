import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ImagePlus, X } from "lucide-react";
import { filterAcceptedImages, ACCEPTED_IMAGE_TYPES } from "@/lib/media";
import { mediaSrc } from "@/lib/paths";
import { imageFromDrop } from "@/lib/imageDrop";
import { useToast } from "./Toast";

export type PhotoChange = { kind: "keep" } | { kind: "set"; file: File } | { kind: "remove" };

export function usePhotoState(initialPath?: string | null) {
  const [existing, setExisting] = useState<string | null>(initialPath ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    };
  }, [pendingUrl]);

  const pick = useCallback((files: FileList | File[]) => {
    const accepted = filterAcceptedImages(files);
    if (!accepted.length) return;
    setPendingFile(accepted[0]);
    setPendingUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(accepted[0]);
    });
  }, []);

  const clear = useCallback(() => {
    setPendingFile(null);
    setPendingUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setExisting(null);
  }, []);

  const commit = useCallback((path: string) => {
    setPendingFile(null);
    setPendingUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setExisting(path);
  }, []);

  const change = useCallback((): PhotoChange => {
    if (pendingFile) return { kind: "set", file: pendingFile };
    if (!existing && initialPath) return { kind: "remove" };
    return { kind: "keep" };
  }, [pendingFile, existing, initialPath]);

  return {
    src: pendingUrl ?? (existing ? mediaSrc(existing) : null),
    pick,
    clear,
    commit,
    change,
  };
}

export function PhotoPicker({
  src,
  onPick,
  onClear,
  placeholder,
}: {
  src: string | null;
  onPick: (files: FileList | File[]) => void;
  onClear: () => void;
  placeholder: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { show } = useToast();

  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      const files = filterAcceptedImages(
        Array.from(e.clipboardData.items)
          .filter((it) => it.kind === "file")
          .map((it) => it.getAsFile())
          .filter((f): f is File => f !== null),
      );
      if (!files.length) return;
      e.preventDefault();
      onPick(files);
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [onPick]);

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={() => inputRef.current?.click()}
        onHoverStart={() => setHover(true)}
        onHoverEnd={() => setHover(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setHover(true);
        }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHover(false);
          void imageFromDrop(e.dataTransfer).then(
            (file) => file && onPick([file]),
            (err) => show(`Не удалось загрузить картинку: ${err instanceof Error ? err.message : String(err)}`, "error"),
          );
        }}
        whileTap={{ scale: 0.98 }}
        className="relative flex aspect-video w-full cursor-pointer items-center justify-center overflow-hidden rounded-3xl"
        style={{ background: "var(--ds-surface-2)" }}
      >
        {src && (
          <motion.img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            animate={{
              scale: hover ? 1.05 : 1,
              filter: hover ? "brightness(0.6)" : "brightness(1)",
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          {hover ? (
            <motion.span
              key="upload"
              className="relative"
              style={{ color: src ? "#fff" : "var(--ds-accent-ink)" }}
              initial={{ scale: 0.3, opacity: 0, rotate: -35 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.3, opacity: 0, rotate: 35 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
            >
              <ImagePlus size={44} strokeWidth={1.5} />
            </motion.span>
          ) : (
            !src && (
              <motion.span
                key="placeholder"
                className="relative"
                style={{ color: "var(--ds-accent-ink)" }}
                initial={{ scale: 0.3, opacity: 0, rotate: 35 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.3, opacity: 0, rotate: -35 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
              >
                {placeholder}
              </motion.span>
            )
          )}
        </AnimatePresence>
      </motion.button>

      {src && (
        <button
          type="button"
          aria-label="Убрать фото"
          onClick={onClear}
          className="absolute right-4 top-4 grid h-10 w-10 cursor-pointer place-items-center rounded-full transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96]"
          style={{ background: "var(--rg-bg)", color: "var(--rg-text)" }}
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
