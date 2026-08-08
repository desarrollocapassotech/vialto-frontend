import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  facturacionEstadoBadgeClass,
  facturacionEstadoLabel,
  facturacionLifecycleEstado,
  tooltipFacturacionEstado,
  type FacturacionEstado,
} from '@/lib/viajesIndicadores';
import { ViajeFacturacionDetalleModal } from '@/components/viajes/ViajeFacturacionDetalleModal';
import { FacturaViewModal } from '@/components/facturacion/FacturaViewModal';
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useToast } from '@/lib/toast';
import type { Factura, Viaje } from '@/types/api';

type Props = {
  viaje: Pick<Viaje, 'facturacionEstado' | 'factura' | 'cliente' | 'clienteId'>;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
};

const badgeClass =
  'inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider px-1.5 py-0.5 cursor-pointer hover:brightness-95 disabled:opacity-60 disabled:cursor-wait';

function facturaUrl(id: string, tenantId?: string) {
  return tenantId
    ? `/api/platform/facturas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`
    : `/api/facturacion/facturas/${encodeURIComponent(id)}`;
}

/**
 * Badge chico de estado de facturación al cliente, para la grilla de viajes. Clickeable:
 * si ya hay una factura vinculada, va directo a su vista completa (ahorra el paso del
 * modal intermedio); si todavía no hay factura, muestra el modal de detalle actual.
 */
export function ViajeFacturacionIndicador({ viaje, tenantId }: Props) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [facturaCompleta, setFacturaCompleta] = useState<Factura | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const estado = (viaje.facturacionEstado ?? 'sin_facturar') as FacturacionEstado;
  const lifecycle = facturacionLifecycleEstado(estado);

  async function handleClick() {
    if (!viaje.factura) {
      setOpen(true);
      return;
    }
    setCargando(true);
    try {
      const full = await apiJson<Factura>(facturaUrl(viaje.factura.id, tenantId), () => getToken());
      setFacturaCompleta(full);
    } catch (e) {
      showToast(friendlyError(e, 'facturacion'), 'error');
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <span className="inline-flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => void handleClick()}
          disabled={cargando}
          title={`Facturación: ${tooltipFacturacionEstado(viaje)}`}
          className={`${badgeClass} ${facturacionEstadoBadgeClass[lifecycle]}`}
        >
          {facturacionEstadoLabel[lifecycle] ?? lifecycle}
        </button>
        {estado === 'cobrado' && (
          <button
            type="button"
            onClick={() => void handleClick()}
            disabled={cargando}
            title={`Facturación: ${tooltipFacturacionEstado(viaje)}`}
            className={`${badgeClass} ${facturacionEstadoBadgeClass.cobrado}`}
          >
            {facturacionEstadoLabel.cobrado}
          </button>
        )}
      </span>
      {open && (
        <ViajeFacturacionDetalleModal
          viaje={viaje}
          tenantId={tenantId}
          onClose={() => setOpen(false)}
        />
      )}
      {facturaCompleta && (
        <FacturaViewModal
          factura={facturaCompleta}
          clienteNombre={viaje.cliente?.nombre}
          onClose={() => setFacturaCompleta(null)}
          onEditar={() => {
            navigate('/facturacion', {
              state: {
                ...(tenantId ? { tenantId } : {}),
                expandFacturaId: facturaCompleta.id,
              },
            });
          }}
          onVerComprobante={
            facturaCompleta.comprobanteUrl?.trim()
              ? () => setComprobanteUrl(facturaCompleta.comprobanteUrl ?? null)
              : undefined
          }
        />
      )}
      {comprobanteUrl && (
        <AdjuntoPreviewModal
          url={comprobanteUrl}
          title="Comprobante"
          onClose={() => setComprobanteUrl(null)}
        />
      )}
    </>
  );
}
