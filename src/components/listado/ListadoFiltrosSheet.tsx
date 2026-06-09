import { useEffect, useId, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Filter } from 'lucide-react';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { modalOverlayClass } from '@/lib/modalLayers';
import { selectorTriggerClass } from '@/components/ui/SelectorOpcionesSheet';

type Props = {
  activeCount?: number;
  title?: string;
  onClear?: () => void;
  clearDisabled?: boolean;
  children: ReactNode;
};

export function ListadoFiltrosSheet({
  activeCount = 0,
  title = 'Filtros',
  onClear,
  clearDisabled = false,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const resumen =
    activeCount > 0
      ? `${activeCount} activo${activeCount !== 1 ? 's' : ''}`
      : 'Todos';

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={selectorTriggerClass}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Filter
            className={`h-4 w-4 shrink-0 ${activeCount > 0 ? 'text-vialto-fire' : 'text-vialto-steel'}`}
            strokeWidth={2}
            aria-hidden
          />
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Filtros
          </span>
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-vialto-charcoal">
            {resumen}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={2} aria-hidden />
        </span>
      </button>

      {open &&
        createPortal(
          <div className={modalOverlayClass} role="presentation" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-xl border border-black/10 bg-white shadow-lg sm:max-w-lg sm:rounded-lg"
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
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="inline-flex h-11 w-11 items-center justify-center text-vialto-steel hover:bg-vialto-mist"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

              <div className="flex shrink-0 flex-col gap-2 border-t border-black/10 p-4 sm:flex-row">
                {onClear && activeCount > 0 && (
                  <button
                    type="button"
                    onClick={onClear}
                    disabled={clearDisabled}
                    className="inline-flex min-h-11 flex-1 items-center justify-center border border-black/15 bg-white px-4 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-vialto-steel transition-colors hover:bg-vialto-mist disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Limpiar filtros
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center bg-vialto-charcoal px-4 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-white transition-colors hover:bg-vialto-graphite"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
