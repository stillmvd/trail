import { motion } from "motion/react";

const KNOB = { type: "spring" as const, bounce: 0, duration: 0.28 };

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`group/sw relative inline-flex h-7 w-[3.25rem] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-[var(--rg-ease)] before:absolute before:left-1/2 before:top-1/2 before:h-10 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] ${
        checked ? "bg-amber" : "bg-surface-3"
      }`}
    >
      <motion.span
        initial={false}
        animate={{ x: checked ? 28 : 4 }}
        transition={KNOB}
        className={`inline-block h-5 w-5 rounded-full transition-[background-color,scale] duration-200 ease-[var(--rg-ease)] group-active/sw:scale-x-[1.2] ${
          checked ? "bg-ink" : "bg-muted"
        }`}
      />
    </button>
  );
}
