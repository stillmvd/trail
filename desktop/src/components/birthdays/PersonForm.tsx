import { useState } from "react";
import { Cake } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Button } from "@/components/ui/Button";
import { FormGroup } from "@/components/ui/FormGroup";
import { PhotoPicker, usePhotoState, type PhotoChange } from "@/components/ui/PhotoPicker";
import { TIMELINE_MIN_DATE, TIMELINE_MAX_DATE, isValidISODate } from "@/lib/constants";
import { todayISO } from "@/lib/dates";

export type PersonPhotoChange = PhotoChange;

export type PersonFormPayload = {
  name: string;
  birthDate: string;
  hasYear: boolean;
  photo: PersonPhotoChange;
};

export interface PersonFormValues {
  name: string;
  birthDate: string;
  hasYear: boolean;
  photo: string | null;
}

const withYear2000 = (iso: string) => `2000-${iso.slice(5)}`;

interface PersonFormProps {
  initial?: Partial<PersonFormValues>;
  mode?: "create" | "edit";
  submitting?: boolean;
  onSubmit: (payload: PersonFormPayload) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function PersonForm({
  initial,
  mode = "create",
  submitting = false,
  onSubmit,
  onCancel,
  onDelete,
}: PersonFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [hasYear, setHasYear] = useState(initial?.hasYear ?? true);
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? "");

  const photo = usePhotoState(initial?.photo);

  const [nameError, setNameError] = useState<string>();
  const [dateError, setDateError] = useState<string>();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let valid = true;

    if (!name.trim()) {
      setNameError("Имя не может быть пустым");
      valid = false;
    } else {
      setNameError(undefined);
    }

    if (!isValidISODate(birthDate)) {
      setDateError("Выберите дату рождения");
      valid = false;
    } else if (hasYear && (birthDate < TIMELINE_MIN_DATE || birthDate > todayISO())) {
      setDateError("Дата рождения вне диапазона");
      valid = false;
    } else {
      setDateError(undefined);
    }

    if (!valid) return;

    onSubmit({
      name: name.trim(),
      birthDate: hasYear ? birthDate : withYear2000(birthDate),
      hasYear,
      photo: photo.change(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col gap-7">
      <FormGroup>
        <PhotoPicker
          src={photo.src}
          onPick={photo.pick}
          onClear={photo.clear}
          placeholder={<Cake size={44} strokeWidth={1.5} />}
        />

        <Input
          value={name}
          onChange={setName}
          error={nameError}
          autoFocus
          placeholder="Кого добавляем?"
        />
      </FormGroup>

      <FormGroup>
        <SegmentedControl
          label="Год рождения"
          segments={[
            { value: "known", label: "Известен" },
            { value: "unknown", label: "Неизвестен" },
          ]}
          value={hasYear ? "known" : "unknown"}
          onChange={(v) => setHasYear(v === "known")}
        />

        <DatePicker
          label={hasYear ? "Дата рождения" : "День и месяц (год не учитывается)"}
          value={birthDate}
          onChange={setBirthDate}
          error={dateError}
          min={TIMELINE_MIN_DATE}
          max={hasYear ? todayISO() : TIMELINE_MAX_DATE}
        />
      </FormGroup>

      <div className="mt-auto flex items-center justify-between gap-2">
        {onDelete ? (
          <Button type="button" variant="danger" onClick={onDelete} disabled={submitting}>
            Удалить
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" disabled={submitting}>
            {mode === "edit" ? "Сохранить" : "Добавить"}
          </Button>
        </div>
      </div>
    </form>
  );
}
