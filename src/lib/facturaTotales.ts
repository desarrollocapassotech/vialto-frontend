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

export type FacturaTramoTotal = {
  monto: number;
  ivaPct: number;
};

/**
 * IVA de una factura por tramo: cada tramo con su alícuota, y la parte del
 * neto no cubierta por tramos con el IVA de cabecera (0% = exento).
 * Misma fórmula que `ivaMontoDeTramos` del backend.
 */
export function ivaMontoDeTramos(
  importeNeto: number,
  tramos: FacturaTramoTotal[],
  ivaPctCabecera?: number | null,
): number {
  const sumaTramos = roundMoney2(tramos.reduce((s, t) => s + t.monto, 0));
  const undivided = Math.max(0, roundMoney2(importeNeto - sumaTramos));
  const ivaTramos = tramos.reduce(
    (s, t) => roundMoney2(s + roundMoney2((t.monto * t.ivaPct) / 100)),
    0,
  );
  const ivaUndivided = roundMoney2(
    (undivided * (Number(ivaPctCabecera) || 0)) / 100,
  );
  return roundMoney2(ivaTramos + ivaUndivided);
}

/** Total con IVA de una factura por tramo (misma fórmula que el cobro en backend). */
export function importeTotalConIvaPorTramo(
  importeNeto: number,
  tramos: FacturaTramoTotal[],
  ivaPctCabecera?: number | null,
): number {
  return roundMoney2(
    importeNeto + ivaMontoDeTramos(importeNeto, tramos, ivaPctCabecera),
  );
}

/**
 * Monto contra el que se mide el cobro.
 * Por tramo sin ARCA: `importeACobrar` de la API, o neto + `ivaMonto` persistido,
 * o recálculo live. ARCA / sin tramos: neto.
 */
export function importeACobrarFactura(
  f: {
    importe: number;
    facturarPorTramo?: boolean;
    tramos?: FacturaTramoTotal[];
    ivaPct?: number | null;
    ivaMonto?: number | null;
    importeACobrar?: number;
  },
  hasArca: boolean,
): number {
  if (f.importeACobrar != null && Number.isFinite(f.importeACobrar)) {
    return roundMoney2(f.importeACobrar);
  }
  const tramos = f.tramos ?? [];
  if (!hasArca && f.facturarPorTramo && tramos.length > 0) {
    if (f.ivaMonto != null && Number.isFinite(f.ivaMonto)) {
      return roundMoney2(f.importe + f.ivaMonto);
    }
    return importeTotalConIvaPorTramo(f.importe, tramos, f.ivaPct);
  }
  return roundMoney2(f.importe);
}
