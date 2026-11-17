import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { DEFAULT_CATEGORY_COLOR } from "@/lib/colors";
import { Input } from "@/components/ui/Input";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useSheetGuard } from "@/components/ui/SideSheet";
import { RefDot } from "./refRows";

export interface CategoryFormPayload {
  name: string;
  icon: string;
  color: string;
  parentId: number | null;
}

export type ParentOption = { id: number; name: string; icon: string; color: string };

export function CategoryForm({
  initial,
  mode,
  parents,
  shade,
  submitting = false,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Partial<CategoryFormPayload>;
  mode: "create" | "edit";
  parents?: ParentOption[];
  shade?: (parentId: number) => string;
  submitting?: boolean;
  onSubmit: (payload: CategoryFormPayload) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "Circle");
  const [color, setColor] = useState(initial?.color ?? DEFAULT_CATEGORY_COLOR);
  const [parentId, setParentId] = useState<number | null>(initial?.parentId ?? null);
  const [nameError, setNameError] = useState<string>();

  const dirty =
    name !== (initial?.name ?? "") ||
    icon !== (initial?.icon ?? "Circle") ||
    color !== (initial?.color ?? DEFAULT_CATEGORY_COLOR) ||
    parentId !== (initial?.parentId ?? null);
  useSheetGuard(dirty);

  const parent = parentId !== null ? parents?.find((p) => p.id === parentId) : undefined;
  const shown = parentId !== null && shade ? shade(parentId) : color;

  const parentOptions: SelectOption[] = [
    { value: "", label: "Верхний уровень" },
    ...(parents ?? []).map((c) => ({ value: String(c.id), label: c.name, icon: c.icon, color: c.color })),
  ];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Добавь название");
      return;
    }
    setNameError(undefined);
    onSubmit({ name: name.trim(), icon, color, parentId });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col gap-6">
      <div className="flex items-center gap-4 rounded-3xl bg-surface-2 p-3">
        <RefDot icon={icon} color={shown} size={56} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className={`truncate text-[17px] font-semibold ${name.trim() ? "text-app-text" : "text-muted"}`}>
            {name.trim() || "Название"}
          </span>
          <span className="truncate text-[13px] text-muted">
            {parent ? `Подкатегория «${parent.name}»` : "Категория верхнего уровня"}
          </span>
        </div>
      </div>

      <Input value={name} onChange={setName} error={nameError} autoFocus placeholder="Название" />

      {parents && (
        <Select
          label="Внутри категории"
          options={parentOptions}
          value={parentId !== null ? String(parentId) : ""}
          onChange={(v) => setParentId(v ? Number(v) : null)}
        />
      )}

      {parentId === null ? (
        <ColorPicker label="Цвет" value={color} onChange={setColor} />
      ) : (
        <p className="m-0 text-[13px] leading-snug text-muted [text-wrap:pretty]">
          Цвет берётся от родителя: чем ниже в группе, тем светлее
        </p>
      )}

      <IconPicker columns={8} value={icon} onChange={setIcon} color={shown} />

      <div className="mt-auto flex items-center gap-2 pt-2">
        {onDelete && (
          <Button type="button" variant="danger" onClick={onDelete} disabled={submitting}>
            <Trash2 size={16} strokeWidth={1.75} />
            Удалить
          </Button>
        )}
        <span className="flex-1" />
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Отмена
        </Button>
        <Button type="submit" disabled={submitting}>
          {mode === "edit" ? "Сохранить" : "Создать"}
        </Button>
      </div>
    </form>
  );
}
