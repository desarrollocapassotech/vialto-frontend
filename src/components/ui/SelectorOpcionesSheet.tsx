import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { modalOverlayClass } from '@/lib/modalLayers';

export type SelectorOpcion = {
  id: string;
  label: string;
  trailing?: ReactNode;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  options: SelectorOpcion[];
  activeId: string | null;
  onSelect: (id: string) => void;
  confirmLabel?: string;
};

export const selectorTriggerClass =
  'flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-vialto-fire/40';

export const selectorTabClass = (active: boolean) =>
  [
    'rounded border px-4 py-2 text-sm font-[family-name:var(--font-ui)] uppercase tracking-wider transition-colors',
    active
      ? 'border-vialto-fire bg-vialto-charcoal text-vialto-fire'
      : 'border-vialto-steel/40 bg-white text-vialto-steel hover:border-vialto-fire/50',
  ].join(' ');

export function SelectorOpcionesSheet({
  open,
  onClose,
  title,
  options,
  activeId,
  onSelect,
  confirmLabel = 'Listo',
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
          <h2
            id={titleId}
            className="font-[family-name:var(--font-display)] text-lg tracking-wide text-vialto-charcoal"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-11 w-11 items-center justify-center text-vialto-steel hover:bg-vialto-mist"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {options.map((opt) => {
            const active = activeId === opt.id;
            return (
              <button
                key={opt.id || '__todos__'}
                type="button"
                onClick={() => onSelect(opt.id)}
                className={[
                  'flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors',
                  active
                    ? 'bg-vialto-mist text-vialto-charcoal'
                    : 'text-vialto-charcoal hover:bg-vialto-mist/70',
                ].join(' ')}
              >
                <span className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider">
                  {opt.label}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {opt.trailing}
                  {active && (
                    <span className="text-vialto-fire text-sm font-semibold" aria-hidden>
                      ✓
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-black/10 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center bg-vialto-charcoal px-4 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-white transition-colors hover:bg-vialto-graphite"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
