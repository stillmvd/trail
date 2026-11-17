import { useState, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useQuery, getQueryData, setQueryData, revalidateQuery } from "@/lib/useQuery";
import { bumpDataVersion } from "@/lib/dataVersion";
import { appearItem } from "@/lib/appear";
import { pluralRu } from "@/lib/duration";
import { createLocalStore } from "@/lib/localStore";
import { shadeColor } from "@/lib/colors";
import {
  listCategories,
  countEventsByCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  shadeGroup,
  type Category,
  type CategoryNode,
} from "@/db/queries/categories";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Select, type SelectOption } from "@/components/ui/Select";
import { SideSheet } from "@/components/ui/SideSheet";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/ContextMenu";
import { useToast } from "@/components/ui/Toast";
import { tooltip } from "@/components/ui/Tooltip";
import { CategoryForm, type CategoryFormPayload } from "./CategoryForm";
import { QuickAddRow, RefDot, RefRow, RefsHeader } from "./refRows";

type SheetState = { kind: "edit"; id: number } | { kind: "create"; parentId: number | null } | null;
type MenuState = { x: number; y: number; id: number } | null;

const collapsedStore = createLocalStore<string>("trail.refs.collapsed", "");
const ICON = { size: 16, strokeWidth: 1.75 };

const eventsWord = (n: number) => `${n} ${pluralRu(n, ["событие", "события", "событий"])}`;
const childrenWord = (n: number) => `${n} ${pluralRu(n, ["подкатегория", "подкатегории", "подкатегорий"])}`;
const isDefault = (c: Category) => c.is_default === 1;

function useCollapsed() {
  const raw = collapsedStore.use();
  const ids = new Set(raw.split(",").filter(Boolean).map(Number));
  const toggle = (id: number) => {
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    collapsedStore.set([...ids].join(","));
  };
  return { ids, toggle };
}

export function CategoryManager() {
  const { data } = useQuery(listCategories);
  const { data: counts } = useQuery(countEventsByCategory);
  const { show } = useToast();
  const collapsed = useCollapsed();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [removing, setRemoving] = useState<Category | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  const all = data ?? [];
  const defaults = all.filter(isDefault);
  const rest = all.filter((c) => !isDefault(c));
  const roots = [...defaults, ...rest];
  const own = (id: number) => counts?.[id] ?? 0;
  const rootOf = (id: number) => roots.find((r) => r.id === id);
  const byId = (id: number) => rootOf(id) ?? roots.flatMap((r) => r.children).find((c) => c.id === id);
  const total = (r: CategoryNode) => own(r.id) + r.children.reduce((s, c) => s + own(c.id), 0);

  function nextShade(parentId: number, exceptId?: number) {
    const parent = rootOf(parentId);
    if (!parent) return "#a6a6a6";
    const siblings = parent.children.filter((c) => c.id !== exceptId);
    const index = exceptId !== undefined ? parent.children.findIndex((c) => c.id === exceptId) : -1;
    if (index >= 0) return shadeColor(parent.color, index, parent.children.length);
    return shadeColor(parent.color, siblings.length, siblings.length + 1);
  }

  async function run(work: () => Promise<void>, done: string) {
    setPending(true);
    try {
      await work();
      bumpDataVersion();
      void revalidateQuery(listCategories);
      show(done, "success");
      return true;
    } catch (e) {
      show(String(e), "error");
      return false;
    } finally {
      setPending(false);
    }
  }

  function siblingsOf(parentId: number | null) {
    return parentId === null ? rest : (rootOf(parentId)?.children ?? []);
  }

  const nextOrder = (parentId: number | null) =>
    siblingsOf(parentId).reduce((m, c) => Math.max(m, c.sort_order), 0) + 1;

  async function handleSubmit(payload: CategoryFormPayload) {
    const current = sheet;
    if (!current) return;
    const ok = await run(
      async () => {
        if (current.kind === "edit") {
          const cat = byId(current.id);
          if (!cat) return;
          const moved = payload.parentId !== cat.parent_id;
          await updateCategory(cat.id, {
            ...payload,
            sortOrder: moved ? nextOrder(payload.parentId) : cat.sort_order,
          });
          await shadeGroup(cat.parent_id);
          if (moved) await shadeGroup(payload.parentId);
          if (cat.parent_id === null) await shadeGroup(cat.id);
        } else {
          await createCategory({ ...payload, sortOrder: nextOrder(payload.parentId) });
          await shadeGroup(payload.parentId);
        }
      },
      current.kind === "edit" ? "Категория сохранена" : "Категория создана",
    );
    if (ok) setSheet(null);
  }

  async function quickAdd(parent: CategoryNode, name: string) {
    try {
      await createCategory({
        name,
        icon: parent.icon,
        color: nextShade(parent.id),
        parentId: parent.id,
        sortOrder: nextOrder(parent.id),
      });
      await shadeGroup(parent.id);
      bumpDataVersion();
      await revalidateQuery(listCategories);
    } catch (e) {
      show(String(e), "error");
    }
  }

  async function handleDelete(targetId: number | null) {
    const target = removing;
    if (!target) return;
    const ok = await run(async () => {
      await deleteCategory(target.id, targetId);
      void revalidateQuery(countEventsByCategory);
    }, "Категория удалена");
    if (ok) {
      setRemoving(null);
      setSheet(null);
    }
  }

  function reorderLocal(parentId: number | null, ids: number[]) {
    setQueryData<CategoryNode[]>(listCategories, (prev) => {
      if (!prev) return prev;
      if (parentId === null) {
        const moved = ids.map((id) => prev.find((r) => r.id === id)).filter((r): r is CategoryNode => !!r);
        return [...prev.filter(isDefault), ...moved];
      }
      return prev.map((r) =>
        r.id !== parentId
          ? r
          : { ...r, children: ids.map((id) => r.children.find((c) => c.id === id)).filter((c): c is Category => !!c) },
      );
    });
  }

  async function persist(parentId: number | null) {
    const tree = getQueryData<CategoryNode[]>(listCategories);
    if (!tree) return;
    const list =
      parentId === null ? tree.filter((c) => !isDefault(c)) : (tree.find((r) => r.id === parentId)?.children ?? []);
    try {
      await reorderCategories(
        list.map((c) => c.id),
        parentId === null ? 1 : 0,
      );
      await shadeGroup(parentId);
      bumpDataVersion();
      void revalidateQuery(listCategories);
    } catch (e) {
      show(String(e), "error");
      void revalidateQuery(listCategories);
    }
  }

  function shift(cat: Category, delta: number) {
    const ids = siblingsOf(cat.parent_id).map((c) => c.id);
    const i = ids.indexOf(cat.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderLocal(cat.parent_id, ids);
    void persist(cat.parent_id);
  }

  function openMenu(e: MouseEvent, id: number) {
    e.preventDefault();
    e.stopPropagation();
    const anchor = e.type === "click" ? (e.currentTarget as HTMLElement).getBoundingClientRect() : null;
    setMenu({ x: anchor ? anchor.left : e.clientX, y: anchor ? anchor.bottom + 4 : e.clientY, id });
  }

  function menuItems(cat: Category): ContextMenuItem[] {
    const siblings = siblingsOf(cat.parent_id);
    const i = siblings.findIndex((c) => c.id === cat.id);
    const items: ContextMenuItem[] = [
      { label: "Изменить", icon: <Pencil {...ICON} />, onSelect: () => setSheet({ kind: "edit", id: cat.id }) },
    ];
    if (cat.parent_id === null)
      items.push({ label: "Добавить подкатегорию", icon: <Plus {...ICON} />, onSelect: () => startAdding(cat.id) });
    if (!isDefault(cat) && i > 0)
      items.push({ label: "Поднять", icon: <ArrowUp {...ICON} />, onSelect: () => shift(cat, -1) });
    if (!isDefault(cat) && i >= 0 && i < siblings.length - 1)
      items.push({ label: "Опустить", icon: <ArrowDown {...ICON} />, onSelect: () => shift(cat, 1) });
    if (!isDefault(cat))
      items.push(
        { type: "separator" },
        { label: "Удалить", icon: <Trash2 {...ICON} />, danger: true, onSelect: () => setRemoving(cat) },
      );
    return items;
  }

  function startAdding(id: number) {
    if (collapsed.ids.has(id)) collapsed.toggle(id);
    setAdding(id);
  }

  const editing = sheet?.kind === "edit" ? byId(sheet.id) : undefined;
  const parentsFor = (cat?: Category): CategoryNode[] | undefined => {
    if (cat && cat.parent_id === null && (isDefault(cat) || (rootOf(cat.id)?.children.length ?? 0) > 0))
      return undefined;
    return roots.filter((r) => r.id !== cat?.id);
  };
  const menuCat = menu ? byId(menu.id) : undefined;

  const group = (root: CategoryNode, draggable: boolean, first: boolean) => (
    <GroupCard
      key={root.id}
      root={root}
      first={first}
      total={total(root)}
      own={own}
      collapsed={collapsed.ids.has(root.id)}
      draggable={draggable}
      adding={adding === root.id}
      nextShade={() => nextShade(root.id)}
      onToggle={() => collapsed.toggle(root.id)}
      onOpen={(id) => setSheet({ kind: "edit", id })}
      onMenu={openMenu}
      onStartAdd={() => startAdding(root.id)}
      onStopAdd={() => setAdding(null)}
      onQuickAdd={(name) => quickAdd(root, name)}
      onReorderChildren={(ids) => reorderLocal(root.id, ids)}
      onDropChild={() => persist(root.id)}
      onDropRoot={() => persist(null)}
    />
  );

  return (
    <motion.section {...appearItem} className="flex flex-col gap-3">
      <RefsHeader title="Категории">
        <Button variant="secondary" onClick={() => setSheet({ kind: "create", parentId: null })}>
          <Plus size={15} strokeWidth={1.75} /> Новая категория
        </Button>
      </RefsHeader>

      <div className="flex flex-col rounded-4xl bg-surface-1 p-1.5">
        {defaults.map((r, i) => group(r, false, i === 0))}
        <Reorder.Group
          as="div"
          axis="y"
          values={rest.map((r) => r.id)}
          onReorder={(ids) => reorderLocal(null, ids)}
          className="flex flex-col"
        >
          {rest.map((r, i) => group(r, true, !defaults.length && i === 0))}
        </Reorder.Group>
      </div>

      <SideSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={
          sheet?.kind === "edit"
            ? editing?.parent_id === null
              ? "Категория"
              : "Подкатегория"
            : sheet?.parentId === null
              ? "Новая категория"
              : "Новая подкатегория"
        }
      >
        {sheet?.kind === "edit" && editing && (
          <CategoryForm
            key={`edit-${editing.id}`}
            mode="edit"
            submitting={pending}
            parents={parentsFor(editing)}
            shade={(pid) => nextShade(pid, editing.parent_id === pid ? editing.id : undefined)}
            initial={{ name: editing.name, icon: editing.icon, color: editing.color, parentId: editing.parent_id }}
            onSubmit={handleSubmit}
            onCancel={() => setSheet(null)}
            onDelete={isDefault(editing) ? undefined : () => setRemoving(editing)}
          />
        )}
        {sheet?.kind === "create" && (
          <CategoryForm
            key={`create-${sheet.parentId ?? "root"}`}
            mode="create"
            submitting={pending}
            parents={parentsFor()}
            shade={(pid) => nextShade(pid)}
            initial={{ parentId: sheet.parentId }}
            onSubmit={handleSubmit}
            onCancel={() => setSheet(null)}
          />
        )}
      </SideSheet>

      <ContextMenu
        open={menu !== null && !!menuCat}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        items={menuCat ? menuItems(menuCat) : []}
        onClose={() => setMenu(null)}
      />

      {removing && (
        <DeleteDialog
          key={removing.id}
          category={removing}
          roots={roots}
          own={own(removing.id)}
          childCount={rootOf(removing.id)?.children.length ?? 0}
          pending={pending}
          onConfirm={handleDelete}
          onClose={() => setRemoving(null)}
        />
      )}
    </motion.section>
  );
}

function GroupCard({
  root,
  first,
  total,
  own,
  collapsed,
  draggable,
  adding,
  nextShade,
  onToggle,
  onOpen,
  onMenu,
  onStartAdd,
  onStopAdd,
  onQuickAdd,
  onReorderChildren,
  onDropChild,
  onDropRoot,
}: {
  root: CategoryNode;
  first: boolean;
  total: number;
  own: (id: number) => number;
  collapsed: boolean;
  draggable: boolean;
  adding: boolean;
  nextShade: () => string;
  onToggle: () => void;
  onOpen: (id: number) => void;
  onMenu: (e: MouseEvent, id: number) => void;
  onStartAdd: () => void;
  onStopAdd: () => void;
  onQuickAdd: (name: string) => Promise<void>;
  onReorderChildren: (ids: number[]) => void;
  onDropChild: () => void;
  onDropRoot: () => void;
}) {
  const controls = useDragControls();
  const [dragging, setDragging] = useState(false);
  const folded = collapsed || dragging;
  const n = root.children.length;
  const meta = [total ? eventsWord(total) : "Нет событий", n ? childrenWord(n) : null].filter(Boolean).join(" · ");

  const card = (
    <div className="relative flex flex-col bg-surface-1 py-0.5">
      {!first && <span className="pointer-events-none absolute top-0 right-4 left-[68px] h-px bg-line" />}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(root.id)}
        onContextMenu={(e) => onMenu(e, root.id)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          onOpen(root.id);
        }}
        className="group flex min-h-16 cursor-pointer items-center gap-3 rounded-3xl pr-2 pl-2.5 outline-none transition-colors duration-150 hover:bg-surface-2 focus-visible:bg-surface-2"
      >
        <RefDot icon={root.icon} color={root.color} size={44} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-[16px] font-semibold text-app-text">{root.name}</span>
            {isDefault(root) && (
              <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-muted">
                по умолчанию
              </span>
            )}
          </span>
          <span className="truncate text-[13px] text-muted">{meta}</span>
        </span>
        {draggable && (
          <span
            onPointerDown={(e) => {
              e.stopPropagation();
              controls.start(e);
            }}
            onClick={(e) => e.stopPropagation()}
            className="hidden h-9 w-9 cursor-grab touch-none place-items-center rounded-full text-[var(--ds-text-faint)] transition-colors group-hover:grid hover:text-muted active:cursor-grabbing"
          >
            <GripVertical size={16} strokeWidth={1.75} />
          </span>
        )}
        <CircleButton
          label="Добавить подкатегорию"
          hover
          onClick={(e) => {
            e.stopPropagation();
            onStartAdd();
          }}
        >
          <Plus size={18} strokeWidth={1.75} />
        </CircleButton>
        <CircleButton label="Действия" onClick={(e) => onMenu(e, root.id)}>
          <MoreHorizontal size={18} strokeWidth={1.75} />
        </CircleButton>
        {n > 0 && (
          <CircleButton
            label={collapsed ? "Развернуть" : "Свернуть"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <motion.span
              animate={{ rotate: folded ? -90 : 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="grid place-items-center"
            >
              <ChevronDown size={18} strokeWidth={1.75} />
            </motion.span>
          </CircleButton>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!folded && (n > 0 || adding) && (
          <motion.div
            key="children"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.34 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 pt-0.5 pb-1 pl-6">
              {n > 0 && (
                <Reorder.Group
                  as="div"
                  axis="y"
                  values={root.children.map((c) => c.id)}
                  onReorder={onReorderChildren}
                  className="flex flex-col gap-0.5"
                >
                  {root.children.map((c) => (
                    <RefRow
                      key={c.id}
                      item={c}
                      count={own(c.id)}
                      small
                      draggable
                      onOpen={() => onOpen(c.id)}
                      onMenu={(e) => onMenu(e, c.id)}
                      onDrop={onDropChild}
                    />
                  ))}
                </Reorder.Group>
              )}
              {adding && (
                <QuickAddRow
                  icon={root.icon}
                  color={nextShade()}
                  placeholder="Название подкатегории"
                  onAdd={onQuickAdd}
                  onClose={onStopAdd}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (!draggable) return card;
  return (
    <Reorder.Item
      as="div"
      value={root.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => {
        setDragging(false);
        onDropRoot();
      }}
      whileDrag={{ zIndex: 1, scale: 1.01 }}
      className="relative"
    >
      {card}
    </Reorder.Item>
  );
}

function CircleButton({
  label,
  hover = false,
  onClick,
  children,
}: {
  label: string;
  hover?: boolean;
  onClick: (e: MouseEvent) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      {...tooltip(label, "bottom")}
      onClick={onClick}
      className={`${hover ? "hidden group-hover:grid group-focus-visible:grid" : "grid"} h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-[background-color,color,scale] duration-150 hover:bg-surface-3 hover:text-app-text active:scale-[0.96]`}
    >
      {children}
    </button>
  );
}

function DeleteDialog({
  category,
  roots,
  own,
  childCount,
  pending,
  onConfirm,
  onClose,
}: {
  category: Category;
  roots: CategoryNode[];
  own: number;
  childCount: number;
  pending: boolean;
  onConfirm: (targetId: number | null) => void;
  onClose: () => void;
}) {
  const isRoot = category.parent_id === null;
  const [target, setTarget] = useState(isRoot ? "" : String(category.parent_id));

  const options: SelectOption[] = [{ value: "", label: "Без категории" }];
  for (const r of roots) {
    if (r.id !== category.id) options.push({ value: String(r.id), label: r.name, icon: r.icon, color: r.color });
    if (childCount > 0) continue;
    for (const c of r.children)
      if (c.id !== category.id)
        options.push({ value: String(c.id), label: `${r.name} › ${c.name}`, icon: c.icon, color: c.color });
  }
  const targetName = options.find((o) => o.value === target)?.label ?? "";
  const needsTarget = own > 0 || childCount > 0;

  return (
    <Dialog open onClose={onClose} title={`Удалить «${category.name}»?`} width={420}>
      <div className="flex flex-col gap-4">
        {needsTarget ? (
          <>
            <Select label="Куда перенести" options={options} value={target} onChange={setTarget} />
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] leading-snug text-muted">
              {own > 0 && (
                <li>
                  {eventsWord(own)} — {target ? `в «${targetName}»` : "без категории"}
                </li>
              )}
              {childCount > 0 && (
                <li>
                  {childrenWord(childCount)} — {target ? `внутрь «${targetName}»` : "станут отдельными категориями"}
                </li>
              )}
            </ul>
          </>
        ) : (
          <p className="m-0 text-sm text-muted">Событий в ней нет</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button variant="danger" onClick={() => onConfirm(target ? Number(target) : null)} disabled={pending}>
            Удалить
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
