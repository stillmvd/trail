import { useState } from "react";
import { Plus } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { useReminders } from "@/components/events/RemindersProvider";
import { todayISO } from "@/lib/dates";

export function QuickAdd() {
  const { addReminder } = useReminders();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO);
  const [time, setTime] = useState("");

  const submit = async () => {
    if (!title.trim()) return;
    const ok = await addReminder({
      title,
      note: null,
      date,
      time: time || null,
      repeat: "none",
      repeatEvery: null,
      repeatUnit: null,
      preNotifyMin: 0,
      nag: 0,
      nagIntervalMin: null,
      icon: null,
      color: null,
      eventId: null,
    });
    if (ok) {
      setTitle("");
      setTime("");
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-full bg-surface-1 p-2 pl-6 shadow-sm">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Новое напоминание…"
        aria-label="Новое напоминание"
        className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-app-text outline-none placeholder:text-muted"
      />
      <div className="w-44 shrink-0">
        <DatePicker value={date} onChange={setDate} quick={false} />
      </div>
      <div className="w-28 shrink-0">
        <TimePicker value={time} onChange={setTime} />
      </div>
      <button
        type="button"
        aria-label="Добавить"
        onClick={submit}
        className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-full bg-amber text-ink transition-[scale,filter] duration-150 ease-[var(--rg-ease)] hover:brightness-105 active:scale-[0.96]"
      >
        <Plus size={22} strokeWidth={2} />
      </button>
    </div>
  );
}
