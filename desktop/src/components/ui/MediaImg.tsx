import { useState, type CSSProperties } from "react";
import { mediaSrc, thumbSrc } from "@/lib/paths";

export function MediaImg({
  path,
  full,
  lazy,
  className,
  style,
}: {
  path: string;
  full?: boolean;
  lazy?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const useThumb = !full && failed !== path;
  return (
    <img
      src={useThumb ? thumbSrc(path) : mediaSrc(path)}
      alt=""
      loading={lazy ? "lazy" : undefined}
      decoding={useThumb && !lazy ? "sync" : "async"}
      onError={() => useThumb && setFailed(path)}
      className={className}
      style={style}
    />
  );
}
