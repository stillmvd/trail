import { useState } from "react";
import { TIMELINE_MIN_DATE, TIMELINE_MAX_DATE, isValidISODate } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { REPEAT_OPTIONS, type RepeatKind, type RepeatUnit } from "@/lib/reminders";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Button } from "@/components/ui/Button";
import { FormGroup } from "@/components/ui/FormGroup";
import type { ReminderInput } from "@/db/queries/reminders";
import { DEFAULT_CATEGORY_COLOR } from "@/lib/colors";

export interface ReminderFormValues {
  title: string;
  note: string;
  date: string;
  time: string;
  repeat: RepeatKind;
  repeatEvery: number;
  repeatUnit: RepeatUnit;
  preNotifyMin: number;
  nag: boolean;
  nagIntervalMin: number;
  icon: string;
  color: string;
  eventId: number | null;
}

const DEFAULT_ICON = "Bell";
const DEFAULT_COLOR = DEFAULT_CATEGORY_COLOR;

type PreUnit = "min" | "hour" | "day";

const PRE_UNIT_MINUTES: Record<PreUnit, number> = { min: 1, hour: 60, day: 1440 };

function splitPreNotify(totalMin: number): { value: number; unit: PreUnit } {
  if (totalMin > 0 && totalMin % 1440 === 0) return { value: totalMin / 1440, unit: "day" };
  if (totalMin > 0 && totalMin % 60 === 0) return { value: totalMin / 60, unit: "hour" };
  return { value: totalMin, unit: "min" };
}

export function ReminderForm({
  initial,
  mode = "create",
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Partial<ReminderFormValues>;
  mode?: "create" | "edit";
  onSubmit: (payload: ReminderInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [time, setTime] = useState(initial?.time ?? "");
  const [repeat, setRepeat] = useState<RepeatKind>(initial?.repeat ?? "none");
  const [repeatEvery, setRepeatEvery] = useState(String(initial?.repeatEvery ?? 3));
  const [repeatUnit, setRepeatUnit] = useState<RepeatUnit>(initial?.repeatUnit ?? "day");
  const initialPre = splitPreNotify(initial?.preNotifyMin ?? 0);
  const [preValue, setPreValue] = useState(String(initialPre.value));
  const [preUnit, setPreUnit] = useState<PreUnit>(initialPre.unit);
  const [nag, setNag] = useState(initial?.nag ?? false);
  const [nagIntervalMin, setNagIntervalMin] = useState(String(initial?.nagIntervalMin ?? 30));
  const [icon, setIcon] = useState(initial?.icon ?? DEFAULT_ICON);
  const [color, setColor] = useState(initial?.color ?? DEFAULT_COLOR);

  const [titleError, setTitleError] = useState<string>();
  const [dateError, setDateError] = useState<string>();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let valid = true;

    if (!title.trim()) {
      setTitleError("Название не может быть пустым");
      valid = false;
    } else {
      setTitleError(undefined);
    }

    if (!isValidISODate(date) || date < TIMELINE_MIN_DATE || date > TIMELINE_MAX_DATE) {
      setDateError("Некорректная дата");
      valid = false;
    } else {
      setDateError(undefined);
    }

    if (!valid) return;

    onSubmit({
      title: title.trim(),
      note: note.trim() || null,
      date,
      time: time || null,
      repeat,
      repeatEvery: repeat === "custom" ? Math.max(1, Number(repeatEvery) || 1) : null,
      repeatUnit: repeat === "custom" ? repeatUnit : null,
      preNotifyMin: Math.max(0, Number(preValue) || 0) * PRE_UNIT_MINUTES[preUnit],
      nag: nag ? 1 : 0,
      nagIntervalMin: nag ? Math.max(1, Number(nagIntervalMin) || 30) : null,
      icon,
      color,
      eventId: initial?.eventId ?? null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col gap-7">
      <FormGroup>
        <Input
          value={title}
          onChange={setTitle}
          error={titleError}
          autoFocus
          placeholder="О чём напомнить?"
        />

        <Textarea value={note} onChange={setNote} placeholder="Заметка (необязательно)" />
      </FormGroup>

      <FormGroup>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <DatePicker
            label="Дата"
            value={date}
            onChange={setDate}
            error={dateError}
            min={TIMELINE_MIN_DATE}
            max={TIMELINE_MAX_DATE}
          />
          <TimePicker label="Время" value={time} onChange={setTime} />
        </div>

        <Select
          label="Повтор"
          options={REPEAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={repeat}
          onChange={(v) => setRepeat(v as RepeatKind)}
        />

        {repeat === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Каждые"
              value={repeatEvery}
              onChange={setRepeatEvery}
              type="number"
              min={1}
            />
            <Select
              label="Единица"
              options={[
                { value: "day", label: "дней" },
                { value: "week", label: "недель" },
              ]}
              value={repeatUnit}
              onChange={(v) => setRepeatUnit(v as RepeatUnit)}
            />
          </div>
        )}
      </FormGroup>

      <FormGroup>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Напомнить за (0 — выкл)"
            value={preValue}
            onChange={setPreValue}
            type="number"
            min={0}
          />
          <Select
            label="Единица"
            options={[
              { value: "min", label: "минут" },
              { value: "hour", label: "часов" },
              { value: "day", label: "дней" },
            ]}
            value={preUnit}
            onChange={(v) => setPreUnit(v as PreUnit)}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-app-text">Повторять, пока не выполню</span>
          <Switch label="Повторять, пока не выполню" checked={nag} onChange={setNag} />
        </div>

        {nag && (
          <Input
            label="Интервал повтора, минут"
            value={nagIntervalMin}
            onChange={setNagIntervalMin}
            type="number"
            min={1}
          />
        )}
      </FormGroup>

      <FormGroup>
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} onChange={setIcon} color={color} />
      </FormGroup>

      <div className="mt-auto flex items-center justify-between gap-2">
        {onDelete ? (
          <Button type="button" variant="danger" onClick={onDelete}>
            Удалить
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
          <Button type="submit">{mode === "edit" ? "Сохранить" : "Создать"}</Button>
        </div>
      </div>
    </form>
  );
}
