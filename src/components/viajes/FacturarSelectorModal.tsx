import { useEffect, useRef } from 'react';
import { Receipt, Users } from 'lucide-react';

interface Props {
  onFacturarCliente: () => void;
  onLiquidacion: () => void;
  onClose: () => void;
}

export function FacturarSelectorModal({ onFacturarCliente, onLiquidacion, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm bg-white border border-black/10 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
            Registrar comprobante
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <button
            type="button"
            onClick={() => { onFacturarCliente(); onClose(); }}
            className="w-full flex items-center gap-4 border border-black/15 px-4 py-4 text-left hover:bg-vialto-mist transition-colors group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-vialto-mist group-hover:bg-white transition-colors">
              <Receipt className="h-5 w-5 text-vialto-charcoal" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-medium text-vialto-charcoal">Factura a cliente</p>
              <p className="text-xs text-vialto-steel mt-0.5">Registro manual</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => { onLiquidacion(); onClose(); }}
            className="w-full flex items-center gap-4 border border-black/15 px-4 py-4 text-left hover:bg-vialto-mist transition-colors group"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-vialto-mist group-hover:bg-white transition-colors">
              <Users className="h-5 w-5 text-vialto-charcoal" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-sm font-medium text-vialto-charcoal">Liquidación a transportista</p>
              <p className="text-xs text-vialto-steel mt-0.5">Registro manual</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
