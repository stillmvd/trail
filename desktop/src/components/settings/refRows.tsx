import { createElement, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Reorder, useDragControls } from "motion/react";
import { ChevronRight, GripVertical, Plus } from "lucide-react";
import { resolveIcon } from "@/lib/icons";

export function RefDot({ icon, color, size = 36 }: { icon: string; color: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: `${color}22` }}
    >
      {createElement(resolveIcon(icon), {
        size: size >= 48 ? 20 : 16,
        strokeWidth: 1.75,
        style: { color },
      })}
    </span>
  );
}

type Item = { id: number; name: string; icon: string; color: string };

function activate(e: KeyboardEvent<HTMLDivElement>, run: () => void) {
  if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
  e.preventDefault();
  run();
}

export function RefRow({
  item,
  count,
  small = false,
  selected = false,
  badge,
  draggable = false,
  onOpen,
  onMenu,
  onDrop,
}: {
  item: Item;
  count: number;
  small?: boolean;
  selected?: boolean;
  badge?: ReactNode;
  draggable?: boolean;
  onOpen: () => void;
  onMenu?: (e: MouseEvent) => void;
  onDrop?: () => void;
}) {
  const controls = useDragControls();

  const row = (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onContextMenu={onMenu}
      onKeyDown={(e) => activate(e, onOpen)}
      className={`group flex cursor-pointer items-center gap-3 rounded-full pr-2.5 pl-3 outline-none transition-colors duration-150 ${
        small ? "min-h-11" : "min-h-[52px]"
      } ${selected ? "bg-surface-active" : "hover:bg-surface-2 focus-visible:bg-surface-2"}`}
    >
      <RefDot icon={item.icon} color={item.color} size={small ? 32 : 36} />
      <span className="flex-1 truncate text-[15px] font-medium text-app-text">{item.name}</span>
      {badge}
      <span
        className={`pr-1.5 text-[13px] tabular-nums group-hover:hidden group-focus-visible:hidden ${
          count ? "text-muted" : "text-[var(--ds-text-faint)]"
        }`}
      >
        {count}
      </span>
      <span className="hidden items-center group-hover:flex group-focus-visible:flex">
        <span className="grid h-8 w-8 place-items-center text-muted">
          <ChevronRight size={15} strokeWidth={1.75} />
        </span>
        {draggable && (
          <span
            onPointerDown={(e) => {
              e.stopPropagation();
              controls.start(e);
            }}
            onClick={(e) => e.stopPropagation()}
            className="grid h-8 w-8 cursor-grab touch-none place-items-center rounded-full text-[var(--ds-text-faint)] transition-colors hover:text-muted active:cursor-grabbing"
          >
            <GripVertical size={15} strokeWidth={1.75} />
          </span>
        )}
      </span>
    </div>
  );

  if (!draggable) return row;
  return (
    <Reorder.Item
      as="div"
      value={item.id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      whileDrag={{ zIndex: 1 }}
      className="relative rounded-full bg-surface-1"
    >
      {row}
    </Reorder.Item>
  );
}

export function RefsHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <h2 className="m-0 pl-2 text-[17px] font-semibold leading-tight tracking-[-0.01em] text-app-text">{title}</h2>
      {children}
    </div>
  );
}

export function QuickAddRow({
  icon,
  color,
  placeholder,
  onAdd,
  onClose,
}: {
  icon: string;
  color: string;
  placeholder: string;
  onAdd: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const name = value.trim();
    if (busy) return;
    if (!name) return onClose();
    setBusy(true);
    await onAdd(name);
    setBusy(false);
    setValue("");
  }

  return (
    <div className="flex min-h-11 items-center gap-3 rounded-full bg-surface-2 pr-4 pl-3">
      <RefDot icon={icon} color={color} size={32} />
      <input
        autoFocus
        value={value}
        readOnly={busy}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => !value.trim() && onClose()}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-app-text outline-none placeholder:text-[var(--ds-text-faint)]"
      />
      <span className="shrink-0 text-[12px] text-[var(--ds-text-faint)]">Enter — добавить ещё</span>
    </div>
  );
}

export function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-11 cursor-pointer items-center gap-3 rounded-full pl-3 text-left text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-app-text"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 transition-colors group-hover:bg-surface-3">
        <Plus size={15} strokeWidth={1.75} />
      </span>
      {label}
    </button>
  );
}
