import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { FacturaViewModal } from '@/components/facturacion/FacturaViewModal';
import {
  LiquidacionViewModal,
  type LiquidacionConTransportista,
} from '@/components/liquidaciones/LiquidacionViewModal';
import { abrirAdjuntoEnPestana } from '@/lib/abrirAdjunto';
import { ViewModalShell } from '@/components/ui/ViewModalShell';
import { Loader2 } from 'lucide-react';
import { apiFetch, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { verPdfLiquidacion } from '@/lib/liquidacionContratoPdf';
import { useToast } from '@/lib/toast';
import type { Factura } from '@/types/api';

export type ComprobanteOrigenCc =
  | { tipo: 'factura'; id: string }
  | { tipo: 'liquidacion'; id: string };

type Props = {
  comprobante: ComprobanteOrigenCc;
  contraparteNombre: string;
  /** Tenant con emision-liquido-producto-arca: habilita los campos ARCA del detalle. */
  hasArcaLiquidaciones: boolean;
  onClose: () => void;
};

function liquidacionPdfUrl(id: string, kind: 'pdf' | 'pdf-anulacion') {
  return `/api/integracion-arca/liquidaciones/${encodeURIComponent(id)}/${kind}`;
}

/**
 * Detalle de la factura o liquidación de la que nace un movimiento de Cuenta corriente:
 * trae el registro completo y abre el mismo modal de vista que Facturas/Liquidaciones
 * (igual que los indicadores de la grilla de Viajes).
 */
export function ComprobanteOrigenCcModal({
  comprobante,
  contraparteNombre,
  hasArcaLiquidaciones,
  onClose,
}: Props) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [factura, setFactura] = useState<Factura | null>(null);
  const [liquidacion, setLiquidacion] = useState<LiquidacionConTransportista | null>(null);
  // El host suele pasar una arrow nueva en cada render: no debe volver a disparar el fetch.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let cancelado = false;
    const id = encodeURIComponent(comprobante.id);
    (async () => {
      try {
        if (comprobante.tipo === 'factura') {
          const full = await apiJson<Factura>(`/api/facturacion/facturas/${id}`, () => getToken());
          if (!cancelado) setFactura(full);
        } else {
          const full = await apiJson<LiquidacionConTransportista>(
            `/api/integracion-arca/liquidaciones/${id}`,
            () => getToken(),
          );
          if (!cancelado) setLiquidacion(full);
        }
      } catch (e) {
        if (cancelado) return;
        showToast(
          friendlyError(e, comprobante.tipo === 'factura' ? 'facturacion' : 'liquidaciones'),
          'error',
        );
        onCloseRef.current();
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [comprobante.tipo, comprobante.id, getToken, showToast]);

  async function verPdf(kind: 'pdf' | 'pdf-anulacion', errorMsg: string) {
    if (!liquidacion) return;
    const ventana = window.open('', '_blank');
    try {
      const res = await apiFetch(liquidacionPdfUrl(liquidacion.id, kind), () => getToken());
      if (!res.ok) throw new Error(errorMsg);
      const blobUrl = URL.createObjectURL(await res.blob());
      if (ventana) ventana.location.href = blobUrl;
      else window.open(blobUrl, '_blank');
    } catch (e) {
      ventana?.close();
      showToast(friendlyError(e, 'arca'), 'error');
    }
  }

  /** Adjunto guardado (comprobante o anulación manual) en pestaña nueva, abierta en el click. */
  function verAdjunto(url: string | null | undefined, titulo = 'Comprobante') {
    const u = url?.trim();
    if (u) void abrirAdjuntoEnPestana({ url: u }, () => getToken(), titulo);
  }

  if (factura) {
    return (
      <FacturaViewModal
        getToken={getToken}
        factura={factura}
        clienteNombre={contraparteNombre}
        onClose={onClose}
        onEditar={() =>
          navigate('/facturacion', { state: { expandFacturaId: factura.id } })
        }
        onVerComprobante={
          factura.comprobanteUrl?.trim()
            ? () => verAdjunto(factura.comprobanteUrl)
            : undefined
        }
      />
    );
  }

  if (liquidacion) {
    return (
      <LiquidacionViewModal
        liq={liquidacion}
        ivaPct={liquidacion.ivaPct ?? undefined}
        hasArca={hasArcaLiquidaciones}
        canEdit={['borrador', 'error', 'pendiente_cae'].includes(liquidacion.estado)}
        onClose={onClose}
        onEditar={() => navigate('/liquidaciones')}
        onVerComprobante={
          liquidacion.cbteNro != null
            ? () => void verPdf('pdf', 'Error al generar el PDF')
            : liquidacion.comprobanteUrl?.trim()
              ? () => verAdjunto(liquidacion.comprobanteUrl)
              : undefined
        }
        onVerPdfLiquidacion={() => void verPdfLiquidacion(liquidacion.id, () => getToken())}
        onVerAnulacion={
          liquidacion.estado === 'anulado' && liquidacion.anulacionMetodo !== 'manual'
            ? () => void verPdf('pdf-anulacion', 'Error al generar el PDF de la anulación')
            : undefined
        }
        onVerComprobanteAnulacionManual={
          liquidacion.estado === 'anulado' &&
          liquidacion.anulacionMetodo === 'manual' &&
          liquidacion.anulacionManualComprobanteUrl
            ? () => verAdjunto(liquidacion.anulacionManualComprobanteUrl, 'Comprobante de anulación')
            : undefined
        }
      />
    );
  }

  // Mientras se trae el registro: el modal abre enseguida con un loader, no queda en blanco.
  const nombre = comprobante.tipo === 'factura' ? 'factura' : 'liquidación';
  return (
    <ViewModalShell title={comprobante.tipo === 'factura' ? 'Factura' : 'Liquidación'} onClose={onClose}>
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-vialto-steel" role="status">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Cargando {nombre}…
      </div>
    </ViewModalShell>
  );
}
