import { createElement, useRef, useState, type ReactNode } from "react";
import { Ban, Check, ChevronRight, Search } from "lucide-react";
import type { Category, CategoryNode } from "@/db/queries/categories";
import { resolveIcon } from "@/lib/icons";
import { onColorFor } from "@/lib/colors";
import { SheetLayer, SheetPanel } from "@/components/ui/SheetPanel";

type Pick = (categoryId: number | null, subcategoryId: number | null) => void;

function Dot({ cat, size }: { cat: Category | null; size: number }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full ${cat ? "" : "bg-surface-3 text-muted"}`}
      style={{
        width: size,
        height: size,
        ...(cat && { background: cat.color, color: onColorFor(cat.color) }),
      }}
    >
      {cat ? (
        createElement(resolveIcon(cat.icon), { size: Math.round(size / 2), strokeWidth: 1.75 })
      ) : (
        <Ban size={Math.round(size / 2)} strokeWidth={1.75} />
      )}
    </span>
  );
}

function Row({
  cat,
  label,
  active,
  aux,
  onClick,
}: {
  cat: Category | null;
  label: ReactNode;
  active: boolean;
  aux?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-13 w-full shrink-0 cursor-pointer items-center gap-3 rounded-xs pl-2.5 pr-3.5 text-left text-[15px] font-medium text-app-text transition-[background-color] duration-150 ease-[var(--rg-ease)] first:rounded-t-3xl last:rounded-b-3xl ${
        active ? "bg-surface-active" : "bg-surface-2 hover:bg-surface-3 focus-visible:bg-surface-3"
      }`}
    >
      <Dot cat={cat} size={32} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {aux ?? (active && <Check size={18} strokeWidth={1.75} className="shrink-0" />)}
    </button>
  );
}

function Screen({
  categories,
  categoryId,
  subcategoryId,
  onPick,
  onClose,
}: {
  categories: CategoryNode[];
  categoryId: number | null;
  subcategoryId: number | null;
  onPick: Pick;
  onClose: () => void;
}) {
  const [drill, setDrill] = useState<CategoryNode | null>(null);
  const [query, setQuery] = useState("");
  const back = () => (query ? setQuery("") : drill ? setDrill(null) : onClose());

  const q = query.trim().toLowerCase();
  const found = q
    ? categories.flatMap((c) => [
        ...(c.name.toLowerCase().includes(q) ? [{ cat: c as Category, parent: null as CategoryNode | null }] : []),
        ...c.children.filter((x) => x.name.toLowerCase().includes(q)).map((x) => ({ cat: x, parent: c })),
      ])
    : [];

  let body: ReactNode;
  if (q) {
    body = found.length ? (
      <div className="flex flex-col gap-0.5">
        {found.map(({ cat, parent }) => (
          <Row
            key={cat.id}
            cat={cat}
            label={
              parent ? (
                <>
                  {parent.name}
                  <span className="text-muted"> › </span>
                  {cat.name}
                </>
              ) : (
                cat.name
              )
            }
            active={parent ? subcategoryId === cat.id : categoryId === cat.id && subcategoryId === null}
            onClick={() => (parent ? onPick(parent.id, cat.id) : onPick(cat.id, null))}
          />
        ))}
      </div>
    ) : (
      <p className="px-1 text-sm text-muted">Ничего не найдено</p>
    );
  } else if (drill) {
    body = (
      <>
        <div className="flex flex-col gap-0.5">
          <Row
            cat={drill}
            label={`Всё «${drill.name}»`}
            active={categoryId === drill.id && subcategoryId === null}
            onClick={() => onPick(drill.id, null)}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          {drill.children.map((x) => (
            <Row
              key={x.id}
              cat={x}
              label={x.name}
              active={subcategoryId === x.id}
              onClick={() => onPick(drill.id, x.id)}
            />
          ))}
        </div>
      </>
    );
  } else {
    body = (
      <>
        <div className="flex flex-col gap-0.5">
          <Row cat={null} label="Без категории" active={categoryId === null} onClick={() => onPick(null, null)} />
        </div>
        <div className="flex flex-col gap-0.5">
          {categories.map((c) => {
            const active = categoryId === c.id;
            const sub = active ? c.children.find((x) => x.id === subcategoryId) : undefined;
            return (
              <Row
                key={c.id}
                cat={c}
                label={c.name}
                active={active}
                aux={
                  c.children.length > 0 && (
                    <span className="flex shrink-0 items-center gap-1 text-[13px] text-muted">
                      {sub?.name ?? c.children.length}
                      <ChevronRight size={16} strokeWidth={1.75} />
                    </span>
                  )
                }
                onClick={() => (c.children.length ? setDrill(c) : onPick(c.id, null))}
              />
            );
          })}
        </div>
      </>
    );
  }

  return (
    <SheetPanel title={(!q && drill?.name) || "Категория"} label="Категория" onBack={back}>
      <label className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-surface-2 px-4 text-muted">
        <Search size={16} strokeWidth={1.75} className="shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти категорию"
          aria-label="Найти категорию"
          className="min-w-0 flex-1 bg-transparent text-sm text-app-text outline-none placeholder:text-muted"
        />
      </label>
      {body}
    </SheetPanel>
  );
}

export function CategoryPicker({
  categories,
  categoryId,
  subcategoryId,
  onChange,
}: {
  categories: CategoryNode[];
  categoryId: number | null;
  subcategoryId: number | null;
  onChange: Pick;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const parent = categories.find((c) => c.id === categoryId) ?? null;
  const sub = parent?.children.find((c) => c.id === subcategoryId) ?? null;

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-14 w-full cursor-pointer items-center gap-3 rounded-3xl bg-surface-2 pl-3 pr-4 text-left text-[15px] font-semibold text-app-text transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 active:scale-[0.98]"
      >
        <Dot cat={sub ?? parent} size={32} />
        <span className="min-w-0 flex-1 truncate">
          {!parent ? (
            <span className="text-muted">Без категории</span>
          ) : sub ? (
            <>
              {parent.name}
              <span className="text-muted"> › </span>
              {sub.name}
            </>
          ) : (
            parent.name
          )}
        </span>
        <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-muted" />
      </button>
      <SheetLayer open={open} onExitComplete={() => triggerRef.current?.focus()}>
        <Screen
          key="screen"
          categories={categories}
          categoryId={categoryId}
          subcategoryId={subcategoryId}
          onClose={close}
          onPick={(cat, s) => {
            onChange(cat, s);
            close();
          }}
        />
      </SheetLayer>
    </>
  );
}
