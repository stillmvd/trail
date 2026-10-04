import type { ReactNode } from "react";

export function FormGroup({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-3">{children}</section>;
}
