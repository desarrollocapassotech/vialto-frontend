import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface ToastCtx {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    timerRef.current = setTimeout(() => setMessage(null), 4000);
  }, []);

  function dismiss() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(null);
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 rounded-lg bg-emerald-600 px-5 py-3 shadow-lg text-white text-sm font-medium">
          <span>{message}</span>
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
