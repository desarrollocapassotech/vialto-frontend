import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { FacturaViewModal } from '@/components/facturacion/FacturaViewModal';
import {
  LiquidacionViewModal,
  type LiquidacionConTransportista,
} from '@/components/liquidaciones/LiquidacionViewModal';
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { apiFetch, apiJson } from '@/lib/api';
import { liquidacionContratoPdfUrl } from '@/lib/liquidacionContratoPdf';
import { friendlyError } from '@/lib/friendlyError';
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
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
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

  if (comprobanteUrl) {
    return (
      <AdjuntoPreviewModal
        url={comprobanteUrl}
        title="Comprobante"
        onClose={() => setComprobanteUrl(null)}
      />
    );
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
            ? () => setComprobanteUrl(factura.comprobanteUrl ?? null)
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
        contratoPdfUrl={liquidacionContratoPdfUrl(liquidacion.id)}
        onEditar={() => navigate('/liquidaciones')}
        onVerComprobante={
          liquidacion.cbteNro != null
            ? () => void verPdf('pdf', 'Error al generar el PDF')
            : liquidacion.comprobanteUrl?.trim()
              ? () => setComprobanteUrl(liquidacion.comprobanteUrl ?? null)
              : undefined
        }
        onVerAnulacion={
          liquidacion.estado === 'anulado' && liquidacion.anulacionMetodo !== 'manual'
            ? () => void verPdf('pdf-anulacion', 'Error al generar el PDF de la anulación')
            : undefined
        }
        onVerComprobanteAnulacionManual={
          liquidacion.estado === 'anulado' &&
          liquidacion.anulacionMetodo === 'manual' &&
          liquidacion.anulacionManualComprobanteUrl
            ? () =>
                window.open(
                  liquidacion.anulacionManualComprobanteUrl as string,
                  '_blank',
                  'noopener,noreferrer',
                )
            : undefined
        }
      />
    );
  }

  return null;
}
