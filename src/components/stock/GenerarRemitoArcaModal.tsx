import { useEffect } from 'react';
import { Upload } from 'lucide-react';
import { ArcaLogo } from '@/components/stock/ArcaLogo';

const BTN =
  'inline-flex items-center gap-1.5 h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50';

export function GenerarRemitoArcaModal({
  onClose,
  onCargarRemito,
  disabled = false,
}: {
  onClose: () => void;
  onCargarRemito: () => void;
  disabled?: boolean;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded border border-black/10 bg-white shadow-lg"
      >
        <div className="border-b border-black/10 px-5 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            Generar remito
          </h2>
          <ArcaLogo className="mt-2 h-5 w-auto opacity-45" />
        </div>
        <p className="px-5 py-4 text-sm text-vialto-charcoal leading-relaxed">
          La integración con ARCA para emitir remitos electrónicos todavía no está disponible.
          Por ahora cargá el remito físico escaneado o sacá una foto del documento.
        </p>
        <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4">
          <button
            type="button"
            disabled={disabled}
            onClick={onCargarRemito}
            className={BTN}
          >
            <Upload className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            Cargar remito
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
