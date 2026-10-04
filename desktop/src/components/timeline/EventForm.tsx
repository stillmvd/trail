import { createElement, useState } from "react";
import { ImageIcon, LoaderCircle, Sparkles, Target } from "lucide-react";
import type { CategoryNode } from "@/db/queries/categories";
import type { EventMedia } from "@/db/queries/media";
import {
  SIGNIFICANCE_VALUES,
  TIMELINE_MIN_DATE,
  TIMELINE_MAX_DATE,
  isValidISODate,
  type Significance,
} from "@/lib/constants";
import { getSignificanceMeta } from "@/lib/significance";
import { todayISO } from "@/lib/dates";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { Textarea } from "@/components/ui/Textarea";
import { Select, type SelectOption } from "@/components/ui/Select";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import { SignificanceIcon } from "@/components/ui/SignificanceIcon";
import { Button } from "@/components/ui/Button";
import { FormGroup } from "@/components/ui/FormGroup";
import { PhotoPicker, usePhotoState, type PhotoChange } from "@/components/ui/PhotoPicker";
import { useToast } from "@/components/ui/Toast";
import { resolveIconOrNull } from "@/lib/icons";
import { generateEventImage } from "@/lib/imageGen";

export interface EventFormValues {
  title: string;
  description: string;
  date: string;
  endDate: string | null;
  significance: Significance;
  categoryId: number | null;
  subcategoryId: number | null;
  track: boolean;
}

export interface EventFormPayload {
  title: string;
  description: string;
  date: string;
  endDate: string | null;
  significance: Significance;
  categoryId: number | null;
  track: boolean;
  photo: PhotoChange;
}

interface EventFormProps {
  categories: CategoryNode[];
  initial?: Partial<EventFormValues>;
  initialMedia?: EventMedia[];
  mode?: "create" | "edit";
  submitting?: boolean;
  onSubmit: (payload: EventFormPayload) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const kindSegments: { value: "point" | "period"; label: string }[] = [
  { value: "point", label: "Момент" },
  { value: "period", label: "Период" },
];

export function EventForm({
  categories,
  initial,
  initialMedia,
  mode = "create",
  submitting = false,
  onSubmit,
  onCancel,
  onDelete,
}: EventFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [kind, setKind] = useState<"point" | "period">(initial?.endDate != null ? "period" : "point");
  const [endDate, setEndDate] = useState<string>(initial?.endDate ?? "");
  const [significance, setSignificance] = useState<Significance>(initial?.significance ?? 1);
  const [categoryId, setCategoryId] = useState<number | null>(initial?.categoryId ?? null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(initial?.subcategoryId ?? null);
  const [track, setTrack] = useState<boolean>(initial?.track ?? false);

  const [titleError, setTitleError] = useState<string>();
  const [dateError, setDateError] = useState<string>();
  const [endDateError, setEndDateError] = useState<string>();

  const photo = usePhotoState(initialMedia?.[0]?.path);
  const [generating, setGenerating] = useState(false);
  const { show } = useToast();

  async function handleGenerate() {
    setGenerating(true);
    try {
      photo.pick([await generateEventImage(title, description)]);
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setGenerating(false);
    }
  }

  function handleKindChange(next: "point" | "period") {
    setKind(next);
    if (next === "period" && !endDate) setEndDate(date);
  }

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const selectedSub = selectedCategory?.children.find((c) => c.id === subcategoryId) ?? null;
  const CategoryIcon = resolveIconOrNull(selectedSub?.icon ?? selectedCategory?.icon);
  const subOptions: SelectOption[] = (selectedCategory?.children ?? []).map((c) => ({
    value: String(c.id),
    label: c.name,
    icon: c.icon,
    color: c.color,
  }));

  const categoryOptions: SelectOption[] = [
    { value: "", label: "Без категории" },
    ...categories.map((c) => ({
      value: String(c.id),
      label: c.name,
      icon: c.icon,
      color: c.color,
    })),
  ];

  function handleCategoryChange(value: string) {
    setCategoryId(value ? Number(value) : null);
    setSubcategoryId(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let valid = true;

    if (!title.trim()) {
      setTitleError("Название не может быть пустым");
      valid = false;
    } else {
      setTitleError(undefined);
    }

    if (!isValidISODate(date)) {
      setDateError("Некорректная дата");
      valid = false;
    } else if (date < TIMELINE_MIN_DATE || date > TIMELINE_MAX_DATE) {
      setDateError("Дата вне диапазона таймлайна");
      valid = false;
    } else {
      setDateError(undefined);
    }

    if (kind === "period") {
      if (!isValidISODate(endDate)) {
        setEndDateError("Некорректная дата");
        valid = false;
      } else if (endDate < TIMELINE_MIN_DATE || endDate > TIMELINE_MAX_DATE) {
        setEndDateError("Дата вне диапазона таймлайна");
        valid = false;
      } else if (endDate < date) {
        setEndDateError("Конец раньше начала");
        valid = false;
      } else {
        setEndDateError(undefined);
      }
    } else {
      setEndDateError(undefined);
    }

    if (!valid) return;

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      date,
      endDate: kind === "period" ? endDate : null,
      significance,
      categoryId: subcategoryId ?? categoryId,
      track,
      photo: photo.change(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-1 flex-col gap-4">
      <PhotoPicker
        src={photo.src}
        onPick={photo.pick}
        onClear={photo.clear}
        placeholder={
          generating ? (
            <LoaderCircle size={44} strokeWidth={1.5} className="animate-spin" />
          ) : CategoryIcon ? (
            createElement(CategoryIcon, { size: 44, strokeWidth: 1.5 })
          ) : (
            <ImageIcon size={44} strokeWidth={1.5} />
          )
        }
      />

      <div className="relative">
        <Input
          value={title}
          onChange={setTitle}
          error={titleError}
          autoFocus
          placeholder="Что произошло?"
          className={photo.src ? "" : "pr-12"}
        />
        {!photo.src && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!title.trim() || generating}
            title="Сгенерировать картинку по названию и деталям"
            aria-label="Сгенерировать картинку"
            className="absolute right-1.5 top-1.5 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-surface-3 text-muted transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-amber hover:text-ink active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40"
          >
            {generating ? (
              <LoaderCircle size={16} strokeWidth={1.75} className="animate-spin" />
            ) : (
              <Sparkles size={16} strokeWidth={1.75} />
            )}
          </button>
        )}
      </div>

      <Textarea
        value={description}
        onChange={setDescription}
        placeholder="Детали (необязательно)"
      />

      <FormGroup>
        <SegmentedControl segments={kindSegments} value={kind} onChange={handleKindChange} />

        <div className={kind === "period" ? "grid grid-cols-2 gap-2" : ""}>
          <DatePicker
            value={date}
            onChange={setDate}
            error={dateError}
            min={TIMELINE_MIN_DATE}
            max={TIMELINE_MAX_DATE}
          />
          {kind === "period" && (
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              error={endDateError}
              min={date}
              max={TIMELINE_MAX_DATE}
            />
          )}
        </div>
      </FormGroup>

      <FormGroup>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Значимость">
          {SIGNIFICANCE_VALUES.map((v) => {
            const active = v === significance;
            return (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSignificance(v as Significance)}
                className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-3xl py-3 text-[13px] font-medium transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
                  active ? "bg-surface-3 text-accent-ink" : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-app-text"
                }`}
              >
                <SignificanceIcon level={v as Significance} size={20} />
                {getSignificanceMeta(v).label}
              </button>
            );
          })}
        </div>

        <div className={subOptions.length > 0 ? "grid grid-cols-2 gap-2" : ""}>
          <Select
            options={categoryOptions}
            value={categoryId !== null ? String(categoryId) : ""}
            onChange={handleCategoryChange}
            placeholder="Без категории"
          />
          {subOptions.length > 0 && (
            <Select
              options={[{ value: "", label: "Без подкатегории" }, ...subOptions]}
              value={subcategoryId !== null ? String(subcategoryId) : ""}
              onChange={(v) => setSubcategoryId(v ? Number(v) : null)}
              placeholder="Без подкатегории"
            />
          )}
        </div>

        <label className="flex h-11 cursor-pointer items-center justify-between gap-3 rounded-full bg-surface-2 pl-4 pr-2 text-sm">
          <span className="flex items-center gap-2">
            <Target size={16} strokeWidth={1.75} className="text-muted" />
            Отслеживать
          </span>
          <Switch checked={track} onChange={setTrack} label="Отслеживать" />
        </label>
      </FormGroup>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
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
            {mode === "edit" ? "Сохранить" : "Создать"}
          </Button>
        </div>
      </div>
    </form>
  );
}
