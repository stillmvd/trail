import { ImagePlus } from "lucide-react";

export function DropHint() {
  return (
    <span aria-hidden className="drop-hint">
      <ImagePlus size={36} strokeWidth={1.5} />
    </span>
  );
}
