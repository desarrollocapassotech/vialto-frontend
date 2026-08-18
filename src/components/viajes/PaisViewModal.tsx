import type { Pais } from '@/types/api';
import { modalQuickCreateOverlayClass } from '@/lib/modalLayers';

export function PaisViewModal({
  pais,
  onClose,
}: {
  pais: Pais;
  onClose: () => void;
}) {
  const L = 'text-xs uppercase tracking-[0.08em] text-vialto-steel';

  return (
    <div className={modalQuickCreateOverlayClass()}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded border border-black/10 bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-5 pt-5 pb-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            {pais.nombre}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3">
            <div className="flex flex-col gap-1">
              <span className={L}>Nombre</span>
              <span className="text-sm">{pais.nombre}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className={L}>Código</span>
              <span className="text-sm">{pais.codigo ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className={L}>Origen</span>
              <span className="text-sm">
                {pais.esPredefinido
                  ? 'País predefinido (no editable)'
                  : 'País personalizado'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-black/10 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
