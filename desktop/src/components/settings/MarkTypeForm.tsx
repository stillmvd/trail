import { createElement, useState } from "react";
import { DEFAULT_CATEGORY_COLOR } from "@/lib/colors";
import { resolveIcon } from "@/lib/icons";
import { Input } from "@/components/ui/Input";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Button } from "@/components/ui/Button";
import { FormGroup } from "@/components/ui/FormGroup";

export interface MarkTypeFormPayload {
  name: string;
  icon: string;
  color: string;
}

export function MarkTypeForm({
  initial,
  mode,
  submitting = false,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<MarkTypeFormPayload>;
  mode: "create" | "edit";
  submitting?: boolean;
  onSubmit: (payload: MarkTypeFormPayload) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "Circle");
  const [color, setColor] = useState(initial?.color ?? DEFAULT_CATEGORY_COLOR);
  const [nameError, setNameError] = useState<string>();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Название не может быть пустым");
      return;
    }
    setNameError(undefined);
    onSubmit({ name: name.trim(), icon, color });
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
              placeholder="Название типа"
            />

            <ColorPicker label="Цвет" value={color} onChange={setColor} />
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
