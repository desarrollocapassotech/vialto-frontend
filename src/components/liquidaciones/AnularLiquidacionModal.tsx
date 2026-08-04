import { useEffect, useId, useState, type ReactNode } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { modalOverlayClass } from "@/lib/modalLayers";

const btnGhost =
  "inline-flex min-h-11 items-center text-xs uppercase tracking-wider px-3 py-2 border border-black/20 hover:bg-vialto-mist disabled:opacity-50 disabled:pointer-events-none md:min-h-0 md:py-1.5";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  busy?: boolean;
  /** Error de API al confirmar (se muestra en el modal). */
  error?: string | null;
  /** Contenido extra entre el motivo y los botones (ej. selector NC/ND). */
  children?: ReactNode;
  onConfirm: (motivo: string) => void | Promise<void>;
  onCancel: () => void;
};

export function AnularLiquidacionModal({
  open,
  title = "Anular liquidación",
  message,
  busy = false,
  error = null,
  children,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const motivoId = useId();
  const [motivo, setMotivo] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMotivo("");
    setFieldError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  function handleConfirm() {
    const trimmed = motivo.trim();
    if (!trimmed) {
      setFieldError("Ingresá el motivo de anulación.");
      return;
    }
    setFieldError(null);
    void onConfirm(trimmed);
  }

  return (
    <div
      className={modalOverlayClass.replace("z-50", "z-[120]")}
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-t-xl border border-black/15 bg-white p-5 shadow-lg sm:rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-sm font-semibold text-vialto-charcoal"
        >
          {title}
        </h2>
        <p id={descId} className="mt-2 text-sm text-vialto-steel">
          {message}
        </p>

        <label className="mt-4 grid gap-1.5">
          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel">
            Motivo de anulación <span className="text-red-500">*</span>
          </span>
          <textarea
            id={motivoId}
            value={motivo}
            disabled={busy}
            rows={3}
            maxLength={2000}
            placeholder="Indicá el motivo…"
            onChange={(e) => {
              setMotivo(e.target.value);
              if (fieldError) setFieldError(null);
            }}
            className={`w-full rounded border bg-white px-3 py-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 disabled:opacity-50 ${
              fieldError ? "border-red-400" : "border-black/15"
            }`}
          />
          <CrudFieldError message={fieldError ?? undefined} />
        </label>

        {children && <div className="mt-4">{children}</div>}

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={btnGhost}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleConfirm}
            className={`inline-flex items-center gap-2 ${btnGhost} border-red-300 bg-white text-red-800 hover:bg-red-50`}
          >
            {busy && <Spinner className="h-3.5 w-3.5" />}
            {busy ? "Procesando…" : "Anular"}
          </button>
        </div>
      </div>
    </div>
  );
}
