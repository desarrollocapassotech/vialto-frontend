import { abrirAdjuntoEnPestana } from '@/lib/abrirAdjunto';

/**
 * PDF de liquidación (resumen comercial que genera Vialto para el transportista). Distinto del
 * comprobante: sin ARCA el comprobante es el adjunto manual; este PDF lo arma el sistema.
 * Con `tenantId` (superadmin mirando otra empresa) se usa la ruta de plataforma.
 */
export function liquidacionContratoPdfPath(liquidacionId: string, tenantId?: string): string {
  const id = encodeURIComponent(liquidacionId);
  if (tenantId) {
    return `/api/platform/arca/liquidaciones/${id}/pdf-contrato?tenantId=${encodeURIComponent(tenantId)}`;
  }
  return `/api/integracion-arca/liquidaciones/${id}/pdf-contrato`;
}

/** Abre el PDF de liquidación en una pestaña nueva (misma regla que "Ver comprobante"). */
export function verPdfLiquidacion(
  liquidacionId: string,
  getToken: () => Promise<string | null>,
  tenantId?: string,
) {
  return abrirAdjuntoEnPestana(
    { apiPath: liquidacionContratoPdfPath(liquidacionId, tenantId) },
    getToken,
    'PDF de liquidación',
  );
}
