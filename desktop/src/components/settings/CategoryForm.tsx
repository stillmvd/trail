import { createElement, useState } from "react";
import type { Category } from "@/db/queries/categories";
import { DEFAULT_CATEGORY_COLOR } from "@/lib/colors";
import { resolveIcon } from "@/lib/icons";
import { Input } from "@/components/ui/Input";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormGroup } from "@/components/ui/FormGroup";

export interface CategoryFormPayload {
  name: string;
  icon: string;
  color: string;
  parentId: number | null;
}

export function CategoryForm({
  rootCategories,
  initial,
  mode,
  lockedParentId,
  selfId,
  submitting = false,
  onSubmit,
  onCancel,
}: {
  rootCategories: Category[];
  initial?: Partial<CategoryFormPayload>;
  mode: "create" | "edit";
  lockedParentId?: number | null;
  selfId?: number;
  submitting?: boolean;
  onSubmit: (payload: CategoryFormPayload) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "Circle");
  const [color, setColor] = useState(initial?.color ?? DEFAULT_CATEGORY_COLOR);
  const [parentId, setParentId] = useState<number | null>(
    lockedParentId !== undefined ? lockedParentId : (initial?.parentId ?? null),
  );
  const [nameError, setNameError] = useState<string>();

  const parentLocked = lockedParentId !== undefined;

  const parentOptions: SelectOption[] = [
    { value: "", label: "Без родителя" },
    ...rootCategories
      .filter((c) => c.id !== selfId)
      .map((c) => ({
        value: String(c.id),
        label: c.name,
        icon: c.icon,
        color: c.color,
      })),
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Название не может быть пустым");
      return;
    }
    setNameError(undefined);
    onSubmit({ name: name.trim(), icon, color, parentId });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormGroup>
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-3.5">
            <Input
              label="Название"
              value={name}
              onChange={setName}
              error={nameError}
              autoFocus
              placeholder="Название категории"
            />

            <ColorPicker label="Цвет" value={color} onChange={setColor} />

            {!parentLocked && (
              <Select
                label="Родительская категория"
                options={parentOptions}
                value={parentId !== null ? String(parentId) : ""}
                onChange={(v) => setParentId(v ? Number(v) : null)}
                placeholder="Без родителя"
              />
            )}
          </div>

          <div className="flex flex-col gap-3.5">
            <IconPicker label="Иконка" value={icon} onChange={setIcon} color={color} />

            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted">Предпросмотр</span>
              <div className="flex items-center gap-2.5 rounded-full bg-surface-2 px-3 py-2">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                  style={{ background: `${color}22` }}
                >
                  {createElement(resolveIcon(icon), {
                    size: 16,
                    style: { color },
                  })}
                </span>
                <span className="truncate text-sm font-medium text-app-text">
                  {name.trim() || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </FormGroup>

      <div className="flex justify-end gap-2">
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
