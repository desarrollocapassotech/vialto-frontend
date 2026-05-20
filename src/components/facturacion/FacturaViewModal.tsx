import { useEffect } from 'react';
import type { Factura } from '@/types/api';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const TIPO_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  transportista_externo: 'Transportista externo',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  cobrada: 'Cobrada',
  vencida: 'Vencida',
};

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-950 border-amber-300/90',
  cobrada: 'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  vencida: 'bg-red-100 text-red-950 border-red-400/80',
};

export function FacturaViewModal({
  factura,
  clienteNombre,
  onClose,
  onEditar,
}: {
  factura: Factura;
  clienteNombre?: string;
  onClose: () => void;
  onEditar: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const importeFormato = `${factura.moneda === 'USD' ? 'USD ' : '$ '}${factura.importe.toLocaleString('es-AR')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded border border-black/10 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
              Factura {factura.numero}
            </h2>
            <span
              className={[
                'text-xs font-medium border rounded px-2 py-0.5',
                ESTADO_BADGE[factura.estado] ?? 'border-black/15 text-vialto-steel',
              ].join(' ')}
            >
              {ESTADO_LABEL[factura.estado] ?? factura.estado}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-4">
          {[
            { label: 'Número', value: factura.numero },
            { label: 'Tipo', value: TIPO_LABEL[factura.tipo] ?? factura.tipo },
            { label: 'Cliente', value: clienteNombre },
            { label: 'Importe', value: importeFormato },
            { label: 'Fecha de emisión', value: factura.fechaEmision ? fmtDate(factura.fechaEmision) : null },
            { label: 'Fecha de vencimiento', value: factura.fechaVencimiento ? fmtDate(factura.fechaVencimiento) : null },
            { label: 'Diferencia', value: factura.diferencia != null ? `$ ${factura.diferencia.toLocaleString('es-AR')}` : null },
          ].filter(c => c.value != null && c.value !== '').map((c, i) => (
            <div key={i}>
              <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</p>
              <p className="mt-1 text-sm">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-black/10 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onEditar}
            className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}
