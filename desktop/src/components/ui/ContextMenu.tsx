import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { Check } from "lucide-react";
import { useBack } from "@/lib/back";

export type ContextMenuAction = {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  checked?: boolean;
  onSelect: () => void;
};

export type ContextMenuItem = ContextMenuAction | { type: "separator" };

const EDGE = 8;

export function ContextMenu({
  open,
  x,
  y,
  items,
  header,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  header?: MenuHeader;
  onClose: () => void;
}) {
  useBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    window.addEventListener("wheel", close, { passive: true });
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("wheel", close);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <MenuPanel key={`${x}:${y}`} x={x} y={y} items={items} header={header} onClose={onClose} />,
    document.body,
  );
}

type MenuHeader = { title: string; subtitle: string };

function MenuPanel({
  x,
  y,
  items,
  header,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
  header?: MenuHeader;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const flipX = x + width + EDGE > window.innerWidth;
    const flipY = y + height + EDGE > window.innerHeight;
    el.style.left = `${Math.max(EDGE, flipX ? x - width : x)}px`;
    el.style.top = `${Math.max(EDGE, flipY ? y - height : y)}px`;
    el.style.transformOrigin = `${flipX ? "right" : "left"} ${flipY ? "bottom" : "top"}`;
    el.querySelector<HTMLElement>("[role^='menuitem']")?.focus({ preventScroll: true });
  }, [x, y]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = [...(ref.current?.querySelectorAll<HTMLElement>("[role^='menuitem']") ?? [])];
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = (at + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <motion.div
      ref={ref}
      role="menu"
      onKeyDown={onKeyDown}
      className="fixed z-[120] flex min-w-56 max-w-72 flex-col gap-0.5 rounded-3xl bg-surface-2 p-1.5 shadow-2xl"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", duration: 0.2, bounce: 0 }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {header && (
        <>
          <div className="flex min-w-0 flex-col px-3.5 pb-1.5 pt-2">
            <span className="truncate text-[13px] font-bold text-app-text">{header.title}</span>
            <span className="truncate text-xs text-muted">{header.subtitle}</span>
          </div>
          <span role="separator" className="mx-3 my-1 h-px bg-line" />
        </>
      )}
      {items.map((item, i) => {
        if ("type" in item && item.type === "separator") {
          return <span key={`sep-${i}`} role="separator" className="mx-3 my-1 h-px bg-line" />;
        }
        const action = item as ContextMenuAction;
        return (
          <button
            key={action.label}
            type="button"
            role={action.checked === undefined ? "menuitem" : "menuitemcheckbox"}
            aria-checked={action.checked}
            onClick={() => {
              action.onSelect();
              onClose();
            }}
            className={`flex w-full cursor-pointer items-center gap-2.5 rounded-full px-3.5 py-2 text-left text-[13px] font-medium transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] outline-none hover:bg-surface-3 focus-visible:bg-surface-3 active:scale-[0.96] ${
              action.danger ? "text-rust" : "text-app-text"
            }`}
          >
            {action.icon}
            <span className="min-w-0 flex-1 truncate">{action.label}</span>
            {action.checked && <Check size={16} strokeWidth={1.75} className="shrink-0 text-accent-ink" />}
          </button>
        );
      })}
    </motion.div>
  );
}
