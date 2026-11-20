/**
 * Número de comprobante interno (nov 2026): "Comprobante interno" en ventas, compras,
 * cobros, pagos, facturas y liquidaciones sin comprobante externo propio. El número lo asigna
 * el backend al guardar (`numeroAutomatico: true`); acá solo se muestra la vista previa.
 * Una sola serie por empresa, formato `INT-00000001` (espejo de
 * `vialto-backend/src/shared/util/numero-interno.util.ts`).
 */
export const PREFIJO_NUMERO_INTERNO = 'INT-';

export function esNumeroInterno(numero: string | null | undefined): boolean {
  return /^INT-\d+$/.test(numero?.trim() ?? '');
}

/** Endpoint de vista previa del próximo número, según la pantalla. */
export const URL_NUMERO_INTERNO = {
  cuentaCorriente: '/api/cuenta-corriente/numero-interno',
  facturas: (tenantId?: string) =>
    tenantId
      ? `/api/platform/facturas-numero-interno?tenantId=${encodeURIComponent(tenantId)}`
      : '/api/facturacion/numero-interno',
  liquidaciones: (tenantId?: string) =>
    tenantId
      ? `/api/platform/integracion-arca/numero-interno?tenantId=${encodeURIComponent(tenantId)}`
      : '/api/integracion-arca/numero-interno',
} as const;
