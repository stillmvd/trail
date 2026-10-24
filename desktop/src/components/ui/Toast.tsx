import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

type ToastItem = { id: number; type: ToastType; message: string };

const ToastContext = createContext<{ show: (message: string, type?: ToastType) => void } | null>(
  null,
);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const META: Record<ToastType, { icon: typeof Info; color: string }> = {
  success: { icon: CheckCircle2, color: "var(--ds-success)" },
  error: { icon: AlertCircle, color: "var(--rg-rust)" },
  info: { icon: Info, color: "var(--ds-accent-ink)" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
          <AnimatePresence>
            {toasts.map((t) => {
              const Icon = META[t.type].icon;
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                  className="pointer-events-auto flex items-center gap-3 rounded-full bg-surface-2 py-2.5 pl-2.5 pr-4 text-sm text-app-text shadow-lg"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                    style={{
                      background: `color-mix(in srgb, ${META[t.type].color} 18%, transparent)`,
                      color: META[t.type].color,
                    }}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="max-w-xs text-pretty font-medium">{t.message}</span>
                  <button
                    type="button"
                    aria-label="Закрыть уведомление"
                    onClick={() => dismiss(t.id)}
                    className="relative ml-1 shrink-0 cursor-pointer opacity-70 transition-[opacity,scale] duration-150 ease-[var(--rg-ease)] before:absolute before:left-1/2 before:top-1/2 before:h-10 before:w-10 before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] hover:opacity-100 active:scale-[0.96]"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
