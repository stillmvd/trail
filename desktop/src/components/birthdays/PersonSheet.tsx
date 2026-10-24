import { Pencil, Trash2 } from "lucide-react";
import { formatFullRu, formatDayMonthRu } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import { SideSheet } from "@/components/ui/SideSheet";
import { PersonForm, type PersonFormPayload } from "./PersonForm";
import { AgeHero, BirthdayTiles, PersonPlaceholder } from "./BirthdayParts";
import type { Person } from "@/db/queries/people";
import { MediaImg } from "@/components/ui/MediaImg";

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export type PersonSheetState =
  | { mode: "create" }
  | { mode: "view"; person: Person }
  | { mode: "edit"; person: Person };

interface Props {
  state: PersonSheetState | null;
  onStartEdit: () => void;
  onCreate: (payload: PersonFormPayload) => void;
  onUpdate: (id: number, payload: PersonFormPayload) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export function PersonSheet({ state, onStartEdit, onCreate, onUpdate, onDelete, onClose }: Props) {
  const title =
    state?.mode === "create"
      ? "Новый человек"
      : state?.mode === "edit"
        ? "Редактирование"
        : undefined;

  return (
    <SideSheet open={state !== null} onClose={onClose} title={title}>
      {state?.mode === "create" && <PersonForm key="create" onSubmit={onCreate} onCancel={onClose} />}

      {state?.mode === "edit" && (
        <PersonForm
          key={`edit-${state.person.id}`}
          mode="edit"
          initial={{
            name: state.person.name,
            birthDate: state.person.birth_date,
            hasYear: state.person.has_year === 1,
            photo: state.person.photo,
          }}
          onSubmit={(payload) => onUpdate(state.person.id, payload)}
          onCancel={onClose}
          onDelete={() => onDelete(state.person.id)}
        />
      )}

      {state?.mode === "view" && (
        <div className="flex min-h-full flex-col">
          <PersonView person={state.person} />
          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            <Button variant="danger" onClick={() => onDelete(state.person.id)}>
              <Trash2 size={16} strokeWidth={1.75} />
              Удалить
            </Button>
            <Button variant="secondary" onClick={onStartEdit}>
              <Pencil size={16} strokeWidth={1.75} />
              Редактировать
            </Button>
          </div>
        </div>
      )}
    </SideSheet>
  );
}

function PersonView({ person }: { person: Person }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="aspect-video w-full overflow-hidden rounded-3xl">
        {person.photo ? (
          <MediaImg path={person.photo} full className="h-full w-full object-cover" />
        ) : (
          <PersonPlaceholder />
        )}
      </div>

      <div>
        <h3 className="text-2xl font-bold leading-tight tracking-tight text-app-text">{person.name}</h3>
        <p className="mt-0.5 text-sm text-muted">
          {person.has_year ? formatFullRu(person.birth_date) : cap(formatDayMonthRu(person.birth_date))}
        </p>
      </div>

      <AgeHero person={person} />
      <BirthdayTiles person={person} />
    </div>
  );
}
