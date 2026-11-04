import { useEffect, useRef } from "react";
import { carriesImage, imageFromDrop } from "@/lib/imageDrop";
import { filterAcceptedImages } from "@/lib/media";

const ATTR = "data-event-id";
const OVER = "data-drop-over";

export const eventSurface = (id: number) => ({ [ATTR]: id });

function hit(target: EventTarget | null): { el: HTMLElement; id: number } | null {
  const el = target instanceof Element ? target.closest<HTMLElement>(`[${ATTR}]`) : null;
  const id = Number(el?.getAttribute(ATTR));
  return el && id > 0 ? { el, id } : null;
}

function editable(target: EventTarget | null) {
  return target instanceof Element && !!target.closest("input, textarea, [contenteditable='true']");
}

function selectionAt(target: EventTarget | null): string | null {
  const sel = window.getSelection();
  const text = sel && !sel.isCollapsed ? sel.toString() : "";
  return text.trim() && target instanceof Node && sel?.containsNode(target, true) ? text : null;
}

function pastedImage(data: DataTransfer | null): File | null {
  const files = filterAcceptedImages(
    Array.from(data?.items ?? [])
      .filter((it) => it.kind === "file")
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null),
  );
  return files[0] ?? null;
}

export function useEventSurface({
  onMenu,
  onCopyMenu,
  onImage,
  onImageError,
}: {
  onMenu: (id: number, x: number, y: number) => void;
  onCopyMenu: (text: string, x: number, y: number) => void;
  onImage: (id: number, file: File) => void;
  onImageError: (message: string) => void;
}) {
  const handlers = useRef({ onMenu, onCopyMenu, onImage, onImageError });

  useEffect(() => {
    handlers.current = { onMenu, onCopyMenu, onImage, onImageError };
  });

  useEffect(() => {
    let over: HTMLElement | null = null;
    const mark = (el: HTMLElement | null) => {
      if (over === el) return;
      over?.removeAttribute(OVER);
      over = el;
      over?.setAttribute(OVER, "");
    };

    const onContextMenu = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (import.meta.env.DEV && e.shiftKey) return;
      if (editable(e.target)) return;
      e.preventDefault();
      const text = selectionAt(e.target);
      if (text) return handlers.current.onCopyMenu(text, e.clientX, e.clientY);
      const target = hit(e.target);
      if (target) handlers.current.onMenu(target.id, e.clientX, e.clientY);
    };

    let pointer = { x: -1, y: -1 };
    const onPointerMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
    };

    const onPaste = (e: ClipboardEvent) => {
      if (e.defaultPrevented || editable(document.activeElement)) return;
      if (document.querySelector("[aria-modal='true']")) return;
      const target = hit(document.elementFromPoint(pointer.x, pointer.y));
      if (!target) return;
      const file = pastedImage(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      handlers.current.onImage(target.id, file);
    };

    const onDragOver = (e: DragEvent) => {
      if (e.defaultPrevented) return mark(null);
      const target = hit(e.target);
      if (target && carriesImage(e.dataTransfer)) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        return mark(target.el);
      }
      mark(null);
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "none";
      }
    };

    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) mark(null);
    };

    const onDrop = (e: DragEvent) => {
      mark(null);
      if (e.defaultPrevented || !e.dataTransfer) return;
      const target = hit(e.target);
      if (!target) {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        return;
      }
      e.preventDefault();
      imageFromDrop(e.dataTransfer).then(
        (file) => {
          if (file) handlers.current.onImage(target.id, file);
          else handlers.current.onImageError("Это не картинка — перетащи файл или картинку со страницы");
        },
        (err) => handlers.current.onImageError(`Не удалось загрузить картинку:${err instanceof Error ? err.message : String(err)}`),
      );
    };

    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("paste", onPaste);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    const onDragEnd = () => mark(null);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      mark(null);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, []);
}
