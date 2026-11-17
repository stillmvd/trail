import { useState, type MouseEvent } from "react";
import { motion, Reorder } from "motion/react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useQuery, getQueryData, setQueryData, revalidateQuery } from "@/lib/useQuery";
import { bumpDataVersion } from "@/lib/dataVersion";
import { appearItem } from "@/lib/appear";
import {
  listMarkTypes,
  countMarksByType,
  createMarkType,
  updateMarkType,
  deleteMarkType,
  reorderMarkTypes,
  type MarkType,
} from "@/db/queries/markTypes";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SideSheet } from "@/components/ui/SideSheet";
import { ContextMenu, type ContextMenuItem } from "@/components/ui/ContextMenu";
import { useToast } from "@/components/ui/Toast";
import { CategoryForm, type CategoryFormPayload } from "./CategoryForm";
import { RefRow, RefsHeader } from "./refRows";

type SheetState = { kind: "edit"; id: number } | { kind: "create" } | null;

const ICON = { size: 16, strokeWidth: 1.75 };

export function MarkTypeManager() {
  const { data } = useQuery(listMarkTypes);
  const { data: counts } = useQuery(countMarksByType);
  const { show } = useToast();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: number } | null>(null);
  const [confirm, setConfirm] = useState<MarkType | null>(null);
  const [pending, setPending] = useState(false);

  const types = data ?? [];
  const editing = sheet?.kind === "edit" ? types.find((t) => t.id === sheet.id) : undefined;

  async function handleSubmit({ name, icon, color }: CategoryFormPayload) {
    const current = sheet;
    if (!current) return;
    setPending(true);
    try {
      if (current.kind === "edit") {
        const t = types.find((x) => x.id === current.id);
        if (!t) return;
        await updateMarkType(t.id, { name, icon, color, sortOrder: t.sort_order });
      } else {
        const sortOrder = types.reduce((m, t) => Math.max(m, t.sort_order), 0) + 1;
        await createMarkType({ name, icon, color, sortOrder });
      }
      setSheet(null);
      bumpDataVersion();
      show(current.kind === "edit" ? "Тип сохранён" : "Тип создан", "success");
    } catch (e) {
      show(String(e), "error");
    } finally {
      setPending(false);
    }
  }

  async function handleDelete() {
    const target = confirm;
    setConfirm(null);
    if (!target) return;
    setPending(true);
    try {
      await deleteMarkType(target.id);
      setSheet(null);
      bumpDataVersion();
      show("Тип удалён", "success");
    } catch (e) {
      show(String(e), "error");
    } finally {
      setPending(false);
    }
  }

  function move(ids: number[]) {
    setQueryData<MarkType[]>(listMarkTypes, (prev) =>
      prev ? ids.map((id) => prev.find((t) => t.id === id)).filter((t): t is MarkType => !!t) : prev,
    );
  }

  async function persist() {
    const list = getQueryData<MarkType[]>(listMarkTypes);
    if (!list) return;
    try {
      await reorderMarkTypes(list.map((t) => t.id));
      bumpDataVersion();
    } catch (e) {
      show(String(e), "error");
      void revalidateQuery(listMarkTypes);
    }
  }

  function shift(id: number, delta: number) {
    const ids = types.map((t) => t.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    move(ids);
    void persist();
  }

  function openMenu(e: MouseEvent, id: number) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, id });
  }

  function menuItems(t: MarkType): ContextMenuItem[] {
    const i = types.findIndex((x) => x.id === t.id);
    const items: ContextMenuItem[] = [
      { label: "Изменить", icon: <Pencil {...ICON} />, onSelect: () => setSheet({ kind: "edit", id: t.id }) },
    ];
    if (i > 0) items.push({ label: "Поднять", icon: <ArrowUp {...ICON} />, onSelect: () => shift(t.id, -1) });
    if (i < types.length - 1)
      items.push({ label: "Опустить", icon: <ArrowDown {...ICON} />, onSelect: () => shift(t.id, 1) });
    items.push(
      { type: "separator" },
      { label: "Удалить", icon: <Trash2 {...ICON} />, danger: true, onSelect: () => setConfirm(t) },
    );
    return items;
  }

  const menuType = menu ? types.find((t) => t.id === menu.id) : undefined;

  return (
    <motion.section {...appearItem} className="flex flex-col gap-3">
      <RefsHeader title="Типы отметок">
        <Button variant="secondary" onClick={() => setSheet({ kind: "create" })}>
          <Plus size={15} strokeWidth={1.75} /> Новый тип
        </Button>
      </RefsHeader>

      <div className="rounded-4xl bg-surface-1 p-1.5">
        <Reorder.Group
          as="div"
          axis="y"
          values={types.map((t) => t.id)}
          onReorder={move}
          className="flex flex-col gap-0.5"
        >
          {types.map((t) => (
            <RefRow
              key={t.id}
              item={t}
              count={counts?.[t.id] ?? 0}
              draggable
              onOpen={() => setSheet({ kind: "edit", id: t.id })}
              onMenu={(e) => openMenu(e, t.id)}
              onDrop={persist}
            />
          ))}
        </Reorder.Group>
      </div>

      <SideSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet?.kind === "edit" ? "Тип отметки" : "Новый тип отметки"}
      >
        {sheet?.kind === "edit" && editing && (
          <CategoryForm
            key={`edit-${editing.id}`}
            mode="edit"
            submitting={pending}
            initial={{ name: editing.name, icon: editing.icon, color: editing.color }}
            onSubmit={handleSubmit}
            onCancel={() => setSheet(null)}
            onDelete={() => setConfirm(editing)}
          />
        )}
        {sheet?.kind === "create" && (
          <CategoryForm
            key="create"
            mode="create"
            submitting={pending}
            onSubmit={handleSubmit}
            onCancel={() => setSheet(null)}
          />
        )}
      </SideSheet>

      <ContextMenu
        open={menu !== null && !!menuType}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        items={menuType ? menuItems(menuType) : []}
        onClose={() => setMenu(null)}
      />

      <ConfirmDialog
        open={confirm !== null}
        title="Удалить тип отметки?"
        message={`«${confirm?.name ?? ""}» и все отметки этого типа будут удалены безвозвратно.`}
        onConfirm={handleDelete}
        onClose={() => setConfirm(null)}
      />
    </motion.section>
  );
}
