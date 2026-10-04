import { createElement, useState } from "react";
import { ImageIcon, LoaderCircle, Plus, Sparkles, Target } from "lucide-react";
import type { CategoryNode } from "@/db/queries/categories";
import type { EventMedia } from "@/db/queries/media";
import { TIMELINE_MIN_DATE, TIMELINE_MAX_DATE, isValidISODate, type Significance } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { DatePicker } from "@/components/ui/DatePicker";
import { TextPair } from "@/components/ui/TextPair";
import { SheetHeaderAction } from "@/components/ui/SideSheet";
import { Button } from "@/components/ui/Button";
import { FormGroup } from "@/components/ui/FormGroup";
import { PhotoPicker, usePhotoState, type PhotoChange } from "@/components/ui/PhotoPicker";
import { useToast } from "@/components/ui/Toast";
import { resolveIconOrNull } from "@/lib/icons";
import { generateEventImage } from "@/lib/imageGen";
import { CategoryPicker } from "./CategoryPicker";
import { SignificancePicker } from "./SignificancePicker";

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
  const [endDate, setEndDate] = useState<string>(initial?.endDate ?? "");
  const [endAdded, setEndAdded] = useState(false);
  const isPeriod = endDate !== "";
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

  const selectedCategory = categories.find((c) => c.id === categoryId) ?? null;
  const selectedSub = selectedCategory?.children.find((c) => c.id === subcategoryId) ?? null;
  const CategoryIcon = resolveIconOrNull(selectedSub?.icon ?? selectedCategory?.icon);
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

    if (isPeriod) {
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
      endDate: isPeriod ? endDate : null,
      significance,
      categoryId: subcategoryId ?? categoryId,
      track,
      photo: photo.change(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-1 flex-col gap-7">
      <SheetHeaderAction>
        <span className="group relative">
          <button
            type="button"
            aria-pressed={track}
            aria-label="Отслеживать"
            onClick={() => setTrack(!track)}
            className={`grid h-10 w-10 cursor-pointer place-items-center rounded-full transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
              track ? "bg-amber text-ink" : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-app-text"
            }`}
          >
            <Target size={20} strokeWidth={1.75} />
          </button>
          <span
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-max max-w-[240px] -translate-y-1 rounded-2xl bg-surface-3 px-3.5 py-2 text-[13px] text-app-text opacity-0 shadow-lg transition-[opacity,transform] delay-0 duration-150 ease-[var(--rg-ease)] group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-500"
          >
            {track ? "Отслеживается в разделе «Отслеживание»" : "Отслеживать в разделе «Отслеживание»"}
          </span>
        </span>
      </SheetHeaderAction>

      <FormGroup>
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

        <TextPair
          title={title}
          onTitleChange={setTitle}
          titlePlaceholder="Что произошло?"
          titleError={titleError}
          note={description}
          onNoteChange={setDescription}
          notePlaceholder="Детали (необязательно)"
          autoFocus
          action={
            !photo.src &&
            title.trim() && (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                title="Сгенерировать картинку по названию и деталям"
                aria-label="Сгенерировать картинку"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-surface-3 text-muted transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-amber hover:text-ink active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40"
              >
                {generating ? (
                  <LoaderCircle size={16} strokeWidth={1.75} className="animate-spin" />
                ) : (
                  <Sparkles size={16} strokeWidth={1.75} />
                )}
              </button>
            )
          }
        />
      </FormGroup>

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
        {isPeriod ? (
          <DatePicker
            variant="tile"
            className="rounded-l-xs rounded-r-3xl"
            align="end"
            defaultOpen={endAdded}
            value={endDate}
            onChange={setEndDate}
            error={endDateError}
            min={date}
            max={TIMELINE_MAX_DATE}
            onClear={() => {
              setEndDate("");
              setEndAdded(false);
              setEndDateError(undefined);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setEndDate(date);
              setEndAdded(true);
            }}
            className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-l-xs rounded-r-3xl bg-surface-2 text-sm font-medium text-muted transition-[background-color,color] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 hover:text-app-text"
          >
            <Plus size={16} strokeWidth={1.75} />
            Конец
          </button>
        )}
      </div>

      <FormGroup>
        <SignificancePicker value={significance} onChange={setSignificance} />

        <CategoryPicker
          categories={categories}
          categoryId={categoryId}
          subcategoryId={subcategoryId}
          onChange={(cat, sub) => {
            setCategoryId(cat);
            setSubcategoryId(sub);
          }}
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
            {mode === "edit" ? "Сохранить" : "Создать"}
          </Button>
        </div>
      </div>
    </form>
  );
}
