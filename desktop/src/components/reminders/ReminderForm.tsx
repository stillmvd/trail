import { useState } from "react";
import { TIMELINE_MIN_DATE, TIMELINE_MAX_DATE, isValidISODate } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import type { RepeatKind, RepeatUnit } from "@/lib/reminders";
import { TextPair } from "@/components/ui/TextPair";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Button } from "@/components/ui/Button";
import { FormGroup } from "@/components/ui/FormGroup";
import type { ReminderInput } from "@/db/queries/reminders";
import { DEFAULT_CATEGORY_COLOR } from "@/lib/colors";
import { NagBlock, PreNotifyBlock, RepeatBlock, SettingsStack } from "./ReminderSettings";

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
  const [repeatEvery, setRepeatEvery] = useState(initial?.repeatEvery ?? 3);
  const [repeatUnit, setRepeatUnit] = useState<RepeatUnit>(initial?.repeatUnit ?? "day");
  const [preNotifyMin, setPreNotifyMin] = useState(initial?.preNotifyMin ?? 0);
  const [nag, setNag] = useState(initial?.nag ?? false);
  const [nagIntervalMin, setNagIntervalMin] = useState(initial?.nagIntervalMin ?? 30);
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
      repeatEvery: repeat === "custom" ? repeatEvery : null,
      repeatUnit: repeat === "custom" ? repeatUnit : null,
      preNotifyMin,
      nag: nag ? 1 : 0,
      nagIntervalMin: nag ? nagIntervalMin : null,
      icon,
      color,
      eventId: initial?.eventId ?? null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col gap-7">
      <TextPair
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="О чём напомнить?"
        titleError={titleError}
        note={note}
        onNoteChange={setNote}
        notePlaceholder="Заметка (необязательно)"
        autoFocus
      />

      <div className="grid grid-cols-2 gap-0.5">
        <DatePicker
          variant="tile"
          className="rounded-l-3xl rounded-r-xs"
          value={date}
          onChange={setDate}
          error={dateError}
          min={TIMELINE_MIN_DATE}
          max={TIMELINE_MAX_DATE}
        />
        <TimePicker variant="tile" className="rounded-l-xs rounded-r-3xl" value={time} onChange={setTime} />
      </div>

      <SettingsStack>
        <RepeatBlock
          repeat={repeat}
          every={repeatEvery}
          unit={repeatUnit}
          onChange={(r, every, unit) => {
            setRepeat(r);
            setRepeatEvery(every);
            setRepeatUnit(unit);
          }}
        />
        <PreNotifyBlock value={preNotifyMin} onChange={setPreNotifyMin} />
        <NagBlock nag={nag} interval={nagIntervalMin} onNag={setNag} onInterval={setNagIntervalMin} />
      </SettingsStack>

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
