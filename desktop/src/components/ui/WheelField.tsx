import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// Поле «месяц»/«год»: колесо мыши = ±1 (вверх — назад, вниз — вперёд), шевроны кликабельны.
export function WheelField({
  label,
  ariaLabel,
  isMonth,
  onShift,
}: {
  label: string;
  ariaLabel: string;
  isMonth?: boolean;
  onShift: (delta: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shiftRef = useRef(onShift);

  useEffect(() => {
    shiftRef.current = onShift;
  });

  // Нативный non-passive listener: React-овый onWheel passive, preventDefault в нём не работает.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      shiftRef.current(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      ref={ref}
      className={`tl-wheel${isMonth ? " is-month" : ""}`}
      role="spinbutton"
      aria-label={ariaLabel}
      title="Прокрутите колёсиком"
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Назад"
        className="tl-wheel-chev"
        onClick={() => onShift(-1)}
      >
        <ChevronUp size={13} strokeWidth={1.75} />
      </button>
      <span className="tl-wheel-val">{label}</span>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Вперёд"
        className="tl-wheel-chev"
        onClick={() => onShift(1)}
      >
        <ChevronDown size={13} strokeWidth={1.75} />
      </button>
    </div>
  );
}
