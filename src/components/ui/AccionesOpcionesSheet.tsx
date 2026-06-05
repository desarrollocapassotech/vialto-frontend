import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { modalOverlayClass } from '@/lib/modalLayers';

export type AccionOpcion = {
  id: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: ReactNode;
  options: AccionOpcion[];
};

export function AccionesOpcionesSheet({
  open,
  onClose,
  title = 'Acciones',
  subtitle,
  options,
}: Props) {
  const titleId = useId();

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={modalOverlayClass} role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-xl border border-black/10 bg-white shadow-lg sm:max-w-md sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-[family-name:var(--font-display)] text-lg tracking-wide text-vialto-charcoal"
            >
              {title}
            </h2>
            {subtitle != null && subtitle !== '' && (
              <p className="mt-0.5 truncate text-sm text-vialto-steel">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-vialto-steel hover:bg-vialto-mist"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={opt.disabled}
              onClick={() => {
                onClose();
                opt.onClick();
              }}
              className={[
                'flex min-h-11 w-full items-center rounded-md px-3 py-3 text-left font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-40',
                opt.danger
                  ? 'text-red-700 hover:bg-red-50'
                  : 'text-vialto-charcoal hover:bg-vialto-mist/70',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="shrink-0 border-t border-black/10 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center border border-black/15 bg-white px-4 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-vialto-charcoal transition-colors hover:bg-vialto-mist"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
