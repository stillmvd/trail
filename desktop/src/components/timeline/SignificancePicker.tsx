import { useState } from "react";
import { SIGNIFICANCE_VALUES, type Significance } from "@/lib/constants";
import { getSignificanceMeta } from "@/lib/significance";

const STAR =
  "M12 2.6 14.78 8.24 21 9.15 16.5 13.53 17.56 19.73 12 16.8 6.44 19.73 7.5 13.53 3 9.15 9.22 8.24Z";
const SIZE: Record<Significance, number> = { 1: 30, 2: 26, 3: 22 };

function Star({ level, index }: { level: Significance; index: number }) {
  return (
    <svg
      width={SIZE[level]}
      height={SIZE[level]}
      viewBox="0 0 24 24"
      aria-hidden
      className="tl-sig-star"
      style={{ "--i": index } as React.CSSProperties}
      fill={level === 1 ? "none" : "currentColor"}
      stroke="currentColor"
      strokeWidth={level === 1 ? 1.75 : 1}
      strokeLinejoin="round"
    >
      <path d={STAR} />
    </svg>
  );
}

export function SignificancePicker({
  value,
  onChange,
}: {
  value: Significance;
  onChange: (value: Significance) => void;
}) {
  const [burst, setBurst] = useState(0);

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Значимость">
      {SIGNIFICANCE_VALUES.map((v) => {
        const active = v === value;
        const play = active && burst > 0;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            aria-label={getSignificanceMeta(v).label}
            title={getSignificanceMeta(v).label}
            onClick={() => {
              onChange(v);
              setBurst((b) => b + 1);
            }}
            className={`relative isolate flex h-[72px] cursor-pointer items-center justify-center gap-0.5 rounded-3xl transition-[background-color,color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.96] ${
              active ? "bg-surface-active text-app-text" : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-app-text"
            } ${play ? "tl-sig-play" : ""}`}
          >
            <span key={`s${play ? burst : 0}`} className={`flex gap-0.5 ${v === 3 ? "text-accent-ink" : ""}`}>
              {Array.from({ length: v }, (_, i) => (
                <Star key={i} level={v} index={i} />
              ))}
            </span>
            {v === 3 && <span key={`w${play ? burst : 0}`} className="tl-sig-sweep -z-10" />}
          </button>
        );
      })}
    </div>
  );
}
