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
  viajeId?: string;
};

export type ViajeNetoParaFactura = {
  id?: string;
  monto?: number | null;
  cantidadFactura?: number | null;
  precioUnitarioFactura?: number | null;
};

/**
 * IVA de una factura por tramo: suma el IVA de cada tramo cargado.
 * Si se pasan viajes vinculados, los viajes que no tienen ningún tramo cargado
 * usan el IVA de cabecera; el remanente no cubierto de viajes con tramo
 * corresponde al componente exento/internacional y no devenga IVA (0%).
 * Misma fórmula que `ivaMontoDeTramos` del backend.
 */
export function ivaMontoDeTramos(
  importeNeto: number,
  tramos: FacturaTramoTotal[],
  ivaPctCabecera?: number | null,
  viajes?: ViajeNetoParaFactura[],
): number {
  if (tramos.length === 0) {
    return roundMoney2((importeNeto * (Number(ivaPctCabecera) || 0)) / 100);
  }
  const ivaTramos = tramos.reduce(
    (s, t) => roundMoney2(s + roundMoney2((t.monto * t.ivaPct) / 100)),
    0,
  );
  if (viajes && viajes.length > 0) {
    const viajeIdsConTramo = new Set(
      tramos.map((t) => t.viajeId).filter(Boolean),
    );
    const viajesSinTramo = viajes.filter(
      (v) => v.id && !viajeIdsConTramo.has(v.id),
    );
    const sumaViajesSinTramo = roundMoney2(
      viajesSinTramo.reduce((s, v) => s + importeNetoViajeParaFactura(v), 0),
    );
    const ivaViajesSinTramo = roundMoney2(
      (sumaViajesSinTramo * (Number(ivaPctCabecera) || 0)) / 100,
    );
    return roundMoney2(ivaTramos + ivaViajesSinTramo);
  }
  return roundMoney2(ivaTramos);
}

/** Total con IVA de una factura por tramo (misma fórmula que el cobro en backend). */
export function importeTotalConIvaPorTramo(
  importeNeto: number,
  tramos: FacturaTramoTotal[],
  ivaPctCabecera?: number | null,
  viajes?: ViajeNetoParaFactura[],
): number {
  return roundMoney2(
    importeNeto + ivaMontoDeTramos(importeNeto, tramos, ivaPctCabecera, viajes),
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
    viajes?: ViajeNetoParaFactura[];
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
    return importeTotalConIvaPorTramo(f.importe, tramos, f.ivaPct, f.viajes);
  }
  return roundMoney2(f.importe);
}
