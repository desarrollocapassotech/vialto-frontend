import { useEffect, useId } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { modalOverlayClass } from '@/lib/modalLayers';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** default: acción principal oscura; danger: estilo eliminación */
  tone?: 'default' | 'danger';
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

const btnGhost =
  'inline-flex min-h-11 items-center text-xs uppercase tracking-wider px-3 py-2 border border-black/20 hover:bg-vialto-mist disabled:opacity-50 disabled:pointer-events-none md:min-h-0 md:py-1.5';

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const confirmClass =
    tone === 'danger'
      ? `${btnGhost} border-red-300 bg-white text-red-800 hover:bg-red-50`
      : `${btnGhost} bg-vialto-charcoal text-white border-black/20 hover:bg-vialto-graphite`;

  return (
    <div
      className={modalOverlayClass.replace('z-50', 'z-[120]')}
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
        className="w-full max-w-sm rounded-t-xl border border-black/15 bg-white p-5 shadow-lg sm:rounded"
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
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={btnGhost}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
            className={`inline-flex items-center gap-2 ${confirmClass}`}
          >
            {busy && <Spinner className="h-3.5 w-3.5" />}
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
