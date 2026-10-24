import { useSyncExternalStore } from "react";
import { UpdateBadge } from "@stillmvd/tauri-ship";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";
import { Mark } from "./brand/Mark";
import { tooltip } from "./ui/Tooltip";

const win = getCurrentWindow();

let maximized = false;
let listening = false;
const subs = new Set<() => void>();

function refresh() {
  void win.isMaximized().then((m) => {
    if (m === maximized) return;
    maximized = m;
    subs.forEach((f) => f());
  });
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (!listening) {
    listening = true;
    refresh();
    void win.onResized(refresh);
  }
  return () => subs.delete(cb);
}

const BASE =
  "grid h-8 w-8 cursor-pointer place-items-center rounded-full text-muted transition-colors duration-200 ease-[var(--rg-ease)] focus-visible:outline-offset-[-2px] motion-reduce:transition-none";
const BTN = `${BASE} hover:bg-surface-2 hover:text-app-text`;

export function Titlebar() {
  const isMax = useSyncExternalStore(subscribe, () => maximized);

  return (
    <header data-tauri-drag-region className="flex h-12 shrink-0 items-center pl-5 pr-4">
      <div data-tauri-drag-region className="flex select-none items-center gap-2 [&>*]:pointer-events-none">
        <Mark size={16} />
        <span className="text-sm font-bold tracking-[-0.01em] text-app-text">Trail</span>
      </div>
      <div data-tauri-drag-region className="min-w-12 flex-1 self-stretch" />
      <span className="mr-3 flex empty:hidden">
        <UpdateBadge lang="ru" />
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Свернуть"
          {...tooltip("Свернуть", "bottom")}
          onClick={() => win.minimize()}
          className={BTN}
        >
          <Minus size={16} strokeWidth={1.25} />
        </button>
        <button
          type="button"
          aria-label={isMax ? "Восстановить" : "Развернуть"}
          {...tooltip(isMax ? "Восстановить" : "Развернуть", "bottom")}
          onClick={() => win.toggleMaximize()}
          className={BTN}
        >
          {isMax ? <Copy size={14} strokeWidth={1.25} /> : <Square size={14} strokeWidth={1.25} />}
        </button>
        <button
          type="button"
          aria-label="Закрыть"
          {...tooltip("Закрыть", "bottom")}
          onClick={() => win.close()}
          className={`${BASE} hover:bg-[color-mix(in_srgb,var(--ds-danger)_14%,transparent)] hover:text-rust`}
        >
          <X size={16} strokeWidth={1.25} />
        </button>
      </div>
    </header>
  );
}
