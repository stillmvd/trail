import { useEffect } from "react";
import { useToast } from "./ui/Toast";
import { optimizeMedia, warmThumbs } from "@/lib/mediaOptimize";

const START_DELAY_MS = 2500;
const mb = (n: number) => `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} МБ`;

export function MediaOptimizer() {
  const { show } = useToast();

  useEffect(() => {
    const t = setTimeout(() => {
      optimizeMedia()
        .then((s) => {
          if (s.converted) show(`Фото сжаты: ${mb(s.before)} → ${mb(s.after)}`);
          if (s.failed) show(`Не удалось обработать фото: ${s.failed}`, "error");
          return warmThumbs();
        })
        .catch((e) => show(String(e), "error"));
    }, START_DELAY_MS);
    return () => clearTimeout(t);
  }, [show]);

  return null;
}
