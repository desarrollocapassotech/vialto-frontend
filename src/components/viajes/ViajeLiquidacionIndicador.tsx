import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  liquidacionEstadoBadgeClass,
  liquidacionEstadoLabel,
  tooltipLiquidacionEstado,
  type LiquidacionEstado,
} from '@/lib/viajesIndicadores';
import { liquidacionElegidaDeViaje } from '@/lib/viajesComprobantes';
import { ViajeLiquidacionDetalleModal } from '@/components/viajes/ViajeLiquidacionDetalleModal';
import {
  LiquidacionViewModal,
  type LiquidacionConTransportista,
} from '@/components/liquidaciones/LiquidacionViewModal';
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { apiFetch, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useToast } from '@/lib/toast';
import type { Viaje } from '@/types/api';

type Props = {
  viaje: Pick<Viaje, 'liquidacionEstado' | 'liquidacionesViaje'>;
  /** Clerk org id: solo se pasa en vista superadmin (cross-tenant). */
  tenantId?: string;
};

const badgeClass =
  'inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider px-1.5 py-0.5 cursor-pointer hover:brightness-95 disabled:opacity-60 disabled:cursor-wait';

function liquidacionUrl(id: string, tenantId?: string) {
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  return `/api/integracion-arca/liquidaciones/${encodeURIComponent(id)}${q}`;
}

function liquidacionPdfUrl(id: string, kind: 'pdf' | 'pdf-anulacion', tenantId?: string) {
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  return `/api/integracion-arca/liquidaciones/${encodeURIComponent(id)}/${kind}${q}`;
}

/**
 * Badge chico de estado de liquidación al transportista, para la grilla de viajes.
 * Clickeable: si ya hay una liquidación vinculada, va directo a su vista completa
 * (ahorra el paso del modal intermedio); si todavía no hay, muestra el modal de
 * detalle actual. No se muestra si el viaje no tiene transportista externo o el
 * tenant no tiene integración ARCA (`liquidacionEstado` es `null`).
 */
export function ViajeLiquidacionIndicador({ viaje, tenantId }: Props) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [liquidacionCompleta, setLiquidacionCompleta] =
    useState<LiquidacionConTransportista | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);

  if (viaje.liquidacionEstado == null) return null;
  const estado = viaje.liquidacionEstado as LiquidacionEstado;
  const elegida = liquidacionElegidaDeViaje(viaje);

  async function handleClick() {
    if (!elegida) {
      setOpen(true);
      return;
    }
    setCargando(true);
    try {
      const full = await apiJson<LiquidacionConTransportista>(
        liquidacionUrl(elegida.id, tenantId),
        () => getToken(),
      );
      setLiquidacionCompleta(full);
    } catch (e) {
      showToast(friendlyError(e, 'liquidaciones'), 'error');
    } finally {
      setCargando(false);
    }
  }

  async function verPdf(kind: 'pdf' | 'pdf-anulacion', errorMsg: string) {
    if (!liquidacionCompleta) return;
    const ventana = window.open('', '_blank');
    try {
      const res = await apiFetch(
        liquidacionPdfUrl(liquidacionCompleta.id, kind, tenantId),
        () => getToken(),
      );
      if (!res.ok) throw new Error(errorMsg);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (ventana) ventana.location.href = blobUrl;
      else window.open(blobUrl, '_blank');
    } catch (e) {
      ventana?.close();
      showToast(friendlyError(e, 'arca'), 'error');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={cargando}
        title={`Liquidación: ${tooltipLiquidacionEstado(viaje)}`}
        className={`${badgeClass} ${liquidacionEstadoBadgeClass[estado]}`}
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
      {liquidacionCompleta && (
        <LiquidacionViewModal
          liq={liquidacionCompleta}
          ivaPct={liquidacionCompleta.ivaPct ?? undefined}
          hasArca
          canEdit={['borrador', 'error', 'pendiente_cae'].includes(liquidacionCompleta.estado)}
          onClose={() => setLiquidacionCompleta(null)}
          onEditar={() => {
            const params = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
            navigate(`/liquidaciones${params}`);
          }}
          onVerComprobante={
            liquidacionCompleta.cbteNro != null
              ? () => void verPdf('pdf', 'Error al generar el PDF')
              : liquidacionCompleta.comprobanteUrl?.trim()
                ? () => setComprobanteUrl(liquidacionCompleta.comprobanteUrl ?? null)
                : undefined
          }
          onVerAnulacion={
            liquidacionCompleta.estado === 'anulado'
              ? () => void verPdf('pdf-anulacion', 'Error al generar el PDF de la anulación')
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
