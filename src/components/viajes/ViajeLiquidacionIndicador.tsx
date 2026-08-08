import { useState } from 'react';
import {
  liquidacionEstadoBadgeClass,
  liquidacionEstadoLabel,
  tooltipLiquidacionEstado,
  type LiquidacionEstado,
} from '@/lib/viajesIndicadores';
import { ViajeLiquidacionDetalleModal } from '@/components/viajes/ViajeLiquidacionDetalleModal';
import type { Viaje } from '@/types/api';

type Props = {
  viaje: Pick<Viaje, 'liquidacionEstado' | 'liquidacionesViaje'>;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
};

/**
 * Badge chico de estado de liquidación al transportista, para la grilla de viajes.
 * Clickeable: abre el detalle. No se muestra si el viaje no tiene transportista
 * externo o el tenant no tiene integración ARCA (`liquidacionEstado` es `null`).
 */
export function ViajeLiquidacionIndicador({ viaje, tenantId }: Props) {
  const [open, setOpen] = useState(false);
  if (viaje.liquidacionEstado == null) return null;
  const estado = viaje.liquidacionEstado as LiquidacionEstado;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Liquidación: ${tooltipLiquidacionEstado(viaje)}`}
        className={`inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider px-1.5 py-0.5 cursor-pointer hover:brightness-95 ${liquidacionEstadoBadgeClass[estado]}`}
      >
        {liquidacionEstadoLabel[estado] ?? estado}
      </button>
      {open && (
        <ViajeLiquidacionDetalleModal
          viaje={viaje}
          tenantId={tenantId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
