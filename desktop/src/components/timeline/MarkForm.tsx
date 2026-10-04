import { createElement, useState } from "react";
import type { MarkType } from "@/db/queries/markTypes";
import { TIMELINE_MIN_DATE, TIMELINE_MAX_DATE, isValidISODate } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { resolveIcon } from "@/lib/icons";
import { DatePicker } from "@/components/ui/DatePicker";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { FormGroup } from "@/components/ui/FormGroup";

export interface MarkFormPayload {
  date: string;
  markTypeId: number;
}

interface MarkFormProps {
  markTypes: MarkType[];
  initialDate?: string;
  submitting?: boolean;
  onSubmit: (payload: MarkFormPayload) => void;
  onCancel: () => void;
}

export function MarkForm({
  markTypes,
  initialDate,
  submitting = false,
  onSubmit,
  onCancel,
}: MarkFormProps) {
  const [date, setDate] = useState(initialDate ?? todayISO());
  const [markTypeId, setMarkTypeId] = useState<number | null>(null);
  const [typeError, setTypeError] = useState<string>();
  const [dateError, setDateError] = useState<string>();

  const segments = markTypes.map((t) => ({
    value: String(t.id),
    label: t.name,
    icon: createElement(resolveIcon(t.icon), { size: 16, style: { color: t.color } }),
  }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let valid = true;

    if (markTypeId === null) {
      setTypeError("Выберите тип отметки");
      valid = false;
    } else {
      setTypeError(undefined);
    }

    if (!isValidISODate(date) || date < TIMELINE_MIN_DATE || date > TIMELINE_MAX_DATE) {
      setDateError("Некорректная дата");
      valid = false;
    } else {
      setDateError(undefined);
    }

    if (!valid || markTypeId === null) return;
    onSubmit({ date, markTypeId });
  }

  if (markTypes.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed text-muted">
          Нет типов отметок. Создайте их в «Настройки → Отметки».
        </p>
        <div className="mt-1 flex justify-end">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Закрыть
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-1 flex-col gap-4">
      <FormGroup>
        <div className="flex flex-col gap-1.5">
          <SegmentedControl
            segments={segments}
            value={markTypeId !== null ? String(markTypeId) : ""}
            onChange={(v) => setMarkTypeId(Number(v))}
          />
          {typeError && <span className="text-xs text-rust">{typeError}</span>}
        </div>

        <DatePicker
          value={date}
          onChange={setDate}
          error={dateError}
          min={TIMELINE_MIN_DATE}
          max={TIMELINE_MAX_DATE}
        />
      </FormGroup>

      <div className="mt-auto flex justify-end gap-2 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Отмена
        </Button>
        <Button type="submit" disabled={submitting}>
          Создать
        </Button>
      </div>
    </form>
  );
}
