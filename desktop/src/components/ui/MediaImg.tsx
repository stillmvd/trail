import { useState, type CSSProperties } from "react";
import { mediaSrc, thumbSrc } from "@/lib/paths";

export function MediaImg({
  path,
  full,
  className,
  style,
}: {
  path: string;
  full?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const useThumb = !full && failed !== path;
  return (
    <img
      src={useThumb ? thumbSrc(path) : mediaSrc(path)}
      alt=""
      decoding={useThumb ? "sync" : "async"}
      onError={() => useThumb && setFailed(path)}
      className={className}
      style={style}
    />
  );
}
