import type { Liquidacion } from "@/types/api";

type LiquidacionFechas = Pick<
  Liquidacion,
  "fechaEmision" | "cbteNro" | "proveedorCbteFecha" | "createdAt"
>;

/**
 * Fecha de emisión de una liquidación (columna, filtro y Excel de Liquidaciones, pedido NyM
 * nov 2026). Puede venir medianoche UTC o un instante con hora (createdAt): mostrarla con
 * `fmtDateUtc` y compararla con `fechaDiaYmd`.
 *
 * - Con ARCA (`conArca`, ver `liquidacionConArca`): la fecha del CVLP informada a ARCA. Las
 *   emitidas antes de existir `fechaEmision` usan la fecha de creación. Sin emitir → null.
 * - Sin ARCA / manual: la fecha de la factura del transportista, o la de creación.
 */
export function fechaEmisionLiquidacion(
  liq: LiquidacionFechas,
  conArca: boolean,
): string | null {
  if (conArca) {
    if (liq.fechaEmision) return liq.fechaEmision;
    return liq.cbteNro != null ? liq.createdAt : null;
  }
  return liq.proveedorCbteFecha || liq.createdAt || null;
}
