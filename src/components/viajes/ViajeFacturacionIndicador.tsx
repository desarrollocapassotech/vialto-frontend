import { useState } from 'react';
import {
  facturacionEstadoBadgeClass,
  facturacionEstadoLabel,
  tooltipFacturacionEstado,
  type FacturacionEstado,
} from '@/lib/viajesIndicadores';
import { ViajeFacturacionDetalleModal } from '@/components/viajes/ViajeFacturacionDetalleModal';
import type { Viaje } from '@/types/api';

type Props = {
  viaje: Pick<Viaje, 'facturacionEstado' | 'factura'>;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
};

/** Badge chico de estado de facturación al cliente, para la grilla de viajes. Clickeable: abre el detalle. */
export function ViajeFacturacionIndicador({ viaje, tenantId }: Props) {
  const [open, setOpen] = useState(false);
  const estado = (viaje.facturacionEstado ?? 'sin_facturar') as FacturacionEstado;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Facturación: ${tooltipFacturacionEstado(viaje)}`}
        className={`inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider px-1.5 py-0.5 cursor-pointer hover:brightness-95 ${facturacionEstadoBadgeClass[estado]}`}
      >
        {facturacionEstadoLabel[estado] ?? estado}
      </button>
      {open && (
        <ViajeFacturacionDetalleModal
          viaje={viaje}
          tenantId={tenantId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
