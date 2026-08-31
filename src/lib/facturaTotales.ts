/**
 * Totales de factura alineados con AFIP / backend (`round2` + IVA por alícuota
 * sobre la base neta agrupada, no suma de IVAs sin redondear por línea).
 */

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Neto a facturar de un viaje: si hay cantidad y precio unitario, es ese
 * producto (redondeado a 2 decimales). Si no, el `monto` cargado.
 * Evita que el IVA se calcule sobre un `monto` desfasado respecto de
 * cantidad × precio (lo que muestra la factura original / la calculadora).
 */
export function importeNetoViajeParaFactura(v: {
  monto?: number | null;
  cantidadFactura?: number | null;
  precioUnitarioFactura?: number | null;
}): number {
  if (v.cantidadFactura != null && v.precioUnitarioFactura != null) {
    return roundMoney2(v.cantidadFactura * v.precioUnitarioFactura);
  }
  return roundMoney2(v.monto ?? 0);
}

export function computeFacturaTotalesFromBases(
  items: Array<{ importe: number; ivaPct: number }>,
): { neto: number; iva: number; total: number } {
  const byPct = new Map<number, number>();
  for (const it of items) {
    const base = roundMoney2(it.importe);
    const pct = it.ivaPct;
    byPct.set(pct, roundMoney2((byPct.get(pct) ?? 0) + base));
  }
  let neto = 0;
  let iva = 0;
  for (const [pct, base] of byPct) {
    neto = roundMoney2(neto + base);
    iva = roundMoney2(iva + roundMoney2((base * pct) / 100));
  }
  return { neto, iva, total: roundMoney2(neto + iva) };
}
