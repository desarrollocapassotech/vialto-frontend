import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ToastType = "success" | "error";

interface ToastCtx {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toastData, setToastData] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: ToastType = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToastData({ message: msg, type });
    timerRef.current = setTimeout(() => setToastData(null), 4000);
  }, []);

  function dismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToastData(null);
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toastData && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-lg px-5 py-3 shadow-lg text-white text-sm font-medium ${
            toastData.type === "error" ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          <span>{toastData.message}</span>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 text-white/70 hover:text-white transition-colors leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
