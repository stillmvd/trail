import { useLayoutEffect, useRef, useSyncExternalStore, type FocusEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

type Side = "right" | "bottom";
type Tip = { label: string; rect: DOMRect; side: Side };

const SHOW_DELAY_MS = 400;
const HIDE_DELAY_MS = 90;
const WARM_MS = 500;
const GAP = 10;
const EDGE = 8;

let tip: Tip | null = null;
let hiddenAt = -Infinity;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
const subs = new Set<() => void>();

function set(next: Tip | null) {
  tip = next;
  subs.forEach((f) => f());
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => subs.delete(cb);
}

function showTip(el: HTMLElement, label: string, side: Side) {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  const go = () => set({ label, rect: el.getBoundingClientRect(), side });
  if (tip || performance.now() - hiddenAt < WARM_MS) go();
  else showTimer = setTimeout(go, SHOW_DELAY_MS);
}

function hideTip(now = false) {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  const go = () => {
    if (!tip) return;
    hiddenAt = performance.now();
    set(null);
  };
  if (now) go();
  else hideTimer = setTimeout(go, HIDE_DELAY_MS);
}

export function tooltip(label: string, side: Side = "right") {
  return {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "touch") showTip(e.currentTarget, label, side);
    },
    onPointerLeave: () => hideTip(),
    onPointerDown: () => hideTip(true),
    onFocus: (e: FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(":focus-visible")) showTip(e.currentTarget, label, side);
    },
    onBlur: () => hideTip(true),
  };
}

function anchorOf({ rect, side }: Tip) {
  return side === "right"
    ? { x: rect.right + GAP, y: rect.top + rect.height / 2 }
    : { x: rect.left + rect.width / 2, y: rect.bottom + GAP };
}

export function TooltipHost() {
  const t = useSyncExternalStore(subscribe, () => tip);
  const boxRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !t) return;
    box.style.marginLeft = "0px";
    const r = box.getBoundingClientRect();
    const over = r.right - (window.innerWidth - EDGE);
    const under = EDGE - r.left;
    box.style.marginLeft = `${over > 0 ? -over : under > 0 ? under : 0}px`;
  }, [t]);

  useLayoutEffect(() => {
    const hide = () => hideTip(true);
    window.addEventListener("wheel", hide, { passive: true });
    window.addEventListener("blur", hide);
    window.addEventListener("keydown", hide);
    return () => {
      window.removeEventListener("wheel", hide);
      window.removeEventListener("blur", hide);
      window.removeEventListener("keydown", hide);
    };
  }, []);

  const pos = t ? anchorOf(t) : null;
  const right = t?.side === "right";

  return createPortal(
    <AnimatePresence>
      {t && pos && (
        <motion.div
          key={t.side}
          role="tooltip"
          className="pointer-events-none fixed left-0 top-0 z-[100]"
          style={{ originX: right ? 0 : 0.5, originY: right ? 0.5 : 0 }}
          initial={{ opacity: 0, scale: 0.96, x: pos.x - (right ? 4 : 0), y: pos.y - (right ? 0 : 4) }}
          animate={{ opacity: 1, scale: 1, x: pos.x, y: pos.y }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
          transition={{ type: "spring", duration: 0.28, bounce: 0 }}
        >
          <div
            ref={boxRef}
            className={`whitespace-nowrap rounded-xl bg-surface-3 px-2.5 py-1.5 text-[12.5px] font-medium text-app-text ${
              right ? "-translate-y-1/2" : "-translate-x-1/2"
            }`}
            style={{ boxShadow: "var(--ds-shadow-2)" }}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={t.label}
                className="block"
                initial={{ opacity: 0, y: right ? 4 : 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: right ? -4 : 0 }}
                transition={{ type: "spring", duration: 0.22, bounce: 0 }}
              >
                {t.label}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
