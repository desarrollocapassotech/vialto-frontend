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
 * Determina si los tramos cargados para un viaje reemplazan su monto original.
 * - Con 2 o más tramos cargados para el viaje: el desglose está completo y la suma reemplaza al monto del viaje.
 * - Con 1 solo tramo cargado: si es menor al monto del viaje, se calcula el "resto" automáticamente (no reemplaza);
 *   solo reemplaza si el único tramo supera al monto del viaje.
 */
export function viajeReemplazaMontoPorTramos(
  montoViaje: number,
  tramosDelViaje: Array<{ monto?: number | null }>,
): boolean {
  if (tramosDelViaje.length === 0) return false;
  if (tramosDelViaje.length >= 2) return true;
  const sumaTramos = roundMoney2(
    tramosDelViaje.reduce((s, t) => s + (t.monto ?? 0), 0),
  );
  return sumaTramos > roundMoney2(montoViaje) + 0.005;
}

export function restoSinTramoDeViaje(
  v: ViajeNetoParaFactura,
  tramosDelViaje: Array<{ monto?: number | null }>,
): number {
  const montoViaje = importeNetoViajeParaFactura(v);
  if (viajeReemplazaMontoPorTramos(montoViaje, tramosDelViaje)) return 0;
  const sumaTramos = roundMoney2(
    tramosDelViaje.reduce((s, t) => s + (t.monto ?? 0), 0),
  );
  return Math.max(0, roundMoney2(montoViaje - sumaTramos));
}

function agruparTramosPorViaje<T extends { viajeId?: string }>(
  tramos: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const t of tramos) {
    if (!t.viajeId) continue;
    const list = map.get(t.viajeId);
    if (list) list.push(t);
    else map.set(t.viajeId, [t]);
  }
  return map;
}

/**
 * IVA de una factura por tramo: suma el IVA de cada tramo cargado más el IVA de cabecera
 * sobre el resto no cubierto (viajes sin tramos o viajes con 1 solo tramo parcial).
 * Cuando un viaje tiene 2 o más tramos cargados, su desglose está completo y no genera resto.
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
  let baseResto: number;
  if (viajes && viajes.length > 0) {
    const porViaje = agruparTramosPorViaje(tramos);
    baseResto = roundMoney2(
      viajes.reduce(
        (s, v) =>
          s + restoSinTramoDeViaje(v, v.id ? (porViaje.get(v.id) ?? []) : []),
        0,
      ),
    );
  } else {
    const sumaTramos = roundMoney2(tramos.reduce((s, t) => s + t.monto, 0));
    baseResto = Math.max(0, roundMoney2(importeNeto - sumaTramos));
  }
  const ivaResto = roundMoney2(
    (baseResto * (Number(ivaPctCabecera) || 0)) / 100,
  );
  return roundMoney2(ivaTramos + ivaResto);
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
 * Monto contra el que se mide el cobro (total real con IVA incluido).
 * Aplica a empresas con ARCA y sin ARCA:
 * - `importeACobrar` de la API (si viene).
 * - En facturas por tramo: suma neto + IVA de cada tramo (usando `ivaMonto` persistido o cálculo live).
 * - En facturas estándar: suma neto + IVA (usando `ivaMonto` persistido o aplicando `ivaPct`).
 * - Facturas exentas (0% IVA): preserva el total neto inalterado.
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
  _hasArca?: boolean,
): number {
  if (f.importeACobrar != null && Number.isFinite(f.importeACobrar)) {
    return roundMoney2(f.importeACobrar);
  }
  const tramos = f.tramos ?? [];
  if (f.facturarPorTramo && tramos.length > 0) {
    if (f.ivaMonto != null && Number.isFinite(f.ivaMonto)) {
      return roundMoney2(f.importe + f.ivaMonto);
    }
    return importeTotalConIvaPorTramo(f.importe, tramos, f.ivaPct, f.viajes);
  }
  if (f.ivaMonto != null && Number.isFinite(f.ivaMonto)) {
    return roundMoney2(f.importe + f.ivaMonto);
  }
  const pct = Number(f.ivaPct);
  const iva = Number.isFinite(pct) && pct > 0 ? roundMoney2((f.importe * pct) / 100) : 0;
  return roundMoney2(f.importe + iva);
}
