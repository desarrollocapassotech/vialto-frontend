/** URL del PDF comercial (contrato / liquidación a proveedor). */
export function liquidacionContratoPdfUrl(
  liquidacionId: string,
  opts?: { platform?: boolean; tenantId?: string },
): string {
  const id = encodeURIComponent(liquidacionId);
  if (opts?.platform && opts.tenantId) {
    return `/api/platform/arca/liquidaciones/${id}/pdf-contrato?tenantId=${encodeURIComponent(opts.tenantId)}`;
  }
  return `/api/integracion-arca/liquidaciones/${id}/pdf-contrato`;
}
