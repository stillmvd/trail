import type { ReactNode } from "react";
import { motion } from "motion/react";
import { appearItem } from "@/lib/appear";
import { ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";

const LIST =
  "flex flex-col rounded-4xl bg-surface-1 p-1.5 [&>*+*]:before:pointer-events-none [&>*+*]:before:absolute [&>*+*]:before:left-[68px] [&>*+*]:before:right-4 [&>*+*]:before:top-0 [&>*+*]:before:h-px [&>*+*]:before:bg-line [&>*+*]:before:transition-opacity [&>*+*]:before:content-[''] [&>[data-hover]:hover+*]:before:opacity-0 [&>*+[data-hover]:hover]:before:opacity-0 [&>[data-selected]+*]:before:opacity-0 [&>*+[data-selected]]:before:opacity-0";

export function RowList({ title, still, children }: { title?: string; still?: boolean; children: ReactNode }) {
  const Section = still ? "section" : motion.section;
  const appear = still ? {} : appearItem;
  if (!title) {
    return (
      <Section {...appear} className={LIST}>
        {children}
      </Section>
    );
  }
  return (
    <Section {...appear} className="flex flex-col gap-3">
      <h2 className="m-0 pl-2 text-[17px] font-semibold leading-tight tracking-[-0.01em] text-app-text">{title}</h2>
      <div className={LIST}>{children}</div>
    </Section>
  );
}

export function ChoiceRow({
  icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-selected={selected || undefined}
      data-hover=""
      onClick={onSelect}
      className={`group relative flex min-h-[68px] w-full cursor-pointer items-center gap-4 rounded-3xl py-3 pl-3.5 pr-4 text-left transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] active:scale-[0.99] ${
        selected ? "bg-surface-active" : "hover:bg-surface-2"
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-150 ease-[var(--rg-ease)] ${
          selected ? "bg-amber text-ink" : "bg-surface-2 text-muted group-hover:bg-surface-3 group-hover:text-app-text"
        }`}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium text-app-text">{title}</span>
        {description && <span className="text-[13px] leading-snug text-muted [text-wrap:pretty]">{description}</span>}
      </span>
    </button>
  );
}

export function FieldRow({
  icon,
  title,
  description,
  value,
  onChange,
  type,
  placeholder,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <Row icon={icon} title={title} description={description}>
      <div className="w-[300px] shrink-0">
        <Input
          aria-label={title}
          value={value}
          onChange={onChange}
          type={type}
          placeholder={placeholder}
          spellCheck={false}
          className="w-full"
        />
      </div>
    </Row>
  );
}

export function Row({
  icon,
  title,
  description,
  onClick,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  onClick?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      data-hover={onClick ? "" : undefined}
      className={`group relative flex min-h-[68px] items-center gap-4 rounded-3xl py-3 pl-3.5 pr-4 transition-colors duration-150 ease-[var(--rg-ease)] ${
        onClick ? "cursor-pointer hover:bg-surface-2" : ""
      }`}
    >
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted transition-colors duration-150 ease-[var(--rg-ease)] ${
          onClick ? "group-hover:bg-surface-3 group-hover:text-app-text" : ""
        }`}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium text-app-text">{title}</span>
        {description && <span className="text-[13px] leading-snug text-muted [text-wrap:pretty]">{description}</span>}
      </div>
      {children}
    </div>
  );
}

export function ActionRow({
  icon,
  title,
  description,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-hover=""
      className="group relative flex min-h-[68px] w-full cursor-pointer items-center gap-4 rounded-3xl py-3 pl-3.5 pr-4 text-left transition-[background-color,opacity] duration-150 ease-[var(--rg-ease)] hover:bg-surface-2 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted transition-colors duration-150 ease-[var(--rg-ease)] group-hover:bg-surface-3 group-hover:text-app-text">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium text-app-text">{title}</span>
        {description && <span className="text-[13px] leading-snug text-muted [text-wrap:pretty]">{description}</span>}
      </span>
      <ChevronRight
        size={18}
        strokeWidth={1.75}
        className="shrink-0 text-muted transition-transform duration-150 ease-[var(--rg-ease)] group-hover:translate-x-0.5"
      />
    </button>
  );
}

export function SwitchRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Row icon={icon} title={title} description={description} onClick={() => onChange(!checked)}>
      <span onClick={(e) => e.stopPropagation()} className="flex">
        <Switch checked={checked} onChange={onChange} label={title} />
      </span>
    </Row>
  );
}
