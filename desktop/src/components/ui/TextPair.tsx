import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

export function TextPair({
  title,
  onTitleChange,
  titlePlaceholder,
  titleError,
  note,
  onNoteChange,
  notePlaceholder,
  action,
  autoFocus,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  titlePlaceholder: string;
  titleError?: string;
  note: string;
  onNoteChange: (value: string) => void;
  notePlaceholder: string;
  action?: ReactNode;
  autoFocus?: boolean;
}) {
  const field =
    "block w-full resize-none bg-surface-2 text-app-text outline-none transition-[box-shadow] duration-150 ease-[var(--rg-ease)] field-sizing-content placeholder:font-normal placeholder:text-muted";

  return (
    <div className="flex flex-col gap-0.5">
      <div className="relative">
        <textarea
          rows={1}
          value={title}
          onChange={(e) => onTitleChange(e.target.value.replace(/\n/g, " "))}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }}
          autoFocus={autoFocus}
          placeholder={titlePlaceholder}
          aria-label={titlePlaceholder}
          aria-invalid={Boolean(titleError)}
          className={`${field} rounded-t-3xl rounded-b-xs py-3.5 pl-4 text-[15px] font-semibold leading-snug ${
            action ? "pr-12" : "pr-4"
          } ${titleError ? "shadow-[inset_0_0_0_1.5px_var(--ds-danger)]" : ""}`}
        />
        <AnimatePresence>
          {action && (
            <motion.div
              className="absolute right-2 top-2"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
            >
              {action}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <textarea
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder={notePlaceholder}
        aria-label={notePlaceholder}
        className={`${field} max-h-60 min-h-[76px] rounded-t-xs rounded-b-3xl px-4 py-3 text-sm`}
      />
      {titleError && <span className="mt-1 text-xs text-rust">{titleError}</span>}
    </div>
  );
}
