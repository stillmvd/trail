import type { ReactNode } from "react";

export function FormGroup({
  title,
  accent,
  children,
}: {
  title: string;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="pt-2">
      <h3
        className={`mb-3 inline-block rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${
          accent ? "bg-amber text-ink" : "bg-surface-2 text-muted"
        }`}
      >
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
