import { useEffect, useRef } from "react";
import { carriesImage, imageFromDrop } from "@/lib/imageDrop";

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

export function useEventSurface({
  onMenu,
  onImage,
  onImageError,
}: {
  onMenu: (id: number, x: number, y: number) => void;
  onImage: (id: number, file: File) => void;
  onImageError: (message: string) => void;
}) {
  const handlers = useRef({ onMenu, onImage, onImageError });

  useEffect(() => {
    handlers.current = { onMenu, onImage, onImageError };
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
      const target = hit(e.target);
      if (target) handlers.current.onMenu(target.id, e.clientX, e.clientY);
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
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    const onDragEnd = () => mark(null);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      mark(null);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, []);
}
