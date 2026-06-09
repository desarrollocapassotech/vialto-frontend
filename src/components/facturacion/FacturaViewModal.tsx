import { useEffect } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from '@/components/ui/ViewModalShell';
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
    <ViewModalShell
      title={
        <span className="inline-flex items-center gap-3">
          <span>Factura {factura.numero}</span>
          <span
            className={[
              'text-xs font-medium border rounded px-2 py-0.5',
              ESTADO_BADGE[factura.estado] ?? 'border-black/15 text-vialto-steel',
            ].join(' ')}
          >
            {ESTADO_LABEL[factura.estado] ?? factura.estado}
          </span>
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          <button type="button" onClick={onEditar} className={viewModalBtnPrimary}>
            Editar
          </button>
        </>
      }
    >
      <div className={viewModalGridClass}>
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
    </ViewModalShell>
  );
}
