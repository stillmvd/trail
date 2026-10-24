import { useEffect, useRef } from "react";
import { modeStore, type ViewMode } from "./mode";

const handlers: Array<() => void> = [];

export function useBack(active: boolean, onBack: () => void) {
  const ref = useRef(onBack);
  useEffect(() => {
    ref.current = onBack;
  });
  useEffect(() => {
    if (!active) return;
    const handler = () => ref.current();
    handlers.push(handler);
    return () => {
      handlers.splice(handlers.indexOf(handler), 1);
    };
  }, [active]);
}

export function useBackButton(mode: ViewMode) {
  const history = useRef<ViewMode[]>([]);
  const last = useRef(mode);
  const returning = useRef(false);

  useEffect(() => {
    if (mode === last.current) return;
    if (!returning.current) history.current.push(last.current);
    returning.current = false;
    last.current = mode;
  }, [mode]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 3) return;
      e.preventDefault();
      e.stopPropagation();
      const top = handlers[handlers.length - 1];
      if (top) return top();
      const prev = history.current.pop();
      if (!prev) return;
      returning.current = true;
      modeStore.set(prev);
    };
    const onUp = (e: MouseEvent) => e.button === 3 && e.preventDefault();
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("mouseup", onUp, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("mouseup", onUp, true);
    };
  }, []);
}
