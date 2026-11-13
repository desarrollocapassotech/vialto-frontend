import {
  formatCurrencyArFromNumber,
  normalizeViajeMoneda,
  parseCurrencyAr,
} from "@/lib/currencyMask";
import { numeroVisibleViaje } from "@/lib/viajesFlota";
import type { Viaje } from "@/types/api";

/**
 * Conceptos de una factura además de los viajes (nov 2026): estadía, carga y descarga, gastos
 * del viaje… Solo suman. Mismo formato que los conceptos de liquidación (concepto, cantidad,
 * monto unitario, IVA, subtotal con IVA), pero sin catálogo. Por defecto se precargan con los
 * gastos (`otrosGastos`) de los viajes elegidos. Espejo del backend en
 * `shared/util/factura-conceptos-extra.util.ts` (`Factura.conceptos`).
 */
export type FacturaConcepto = {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  /** Neto sin IVA: cantidad × unitario. */
  importe: number;
  ivaPct: number;
};

export type FacturaConceptoDraft = {
  descripcion: string;
  /** Texto del input de cantidad. */
  cantidadStr: string;
  /** Texto del input de monto unitario (con máscara de moneda). */
  unitarioStr: string;
  /** Texto del input (vacío = IVA de la factura). */
  ivaPctStr: string;
  /** Concepto precargado desde un gasto de ese viaje: se va si se quita el viaje. */
  viajeId?: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function emptyFacturaConcepto(ivaPct: number): FacturaConceptoDraft {
  return { descripcion: "", cantidadStr: "1", unitarioStr: "", ivaPctStr: String(ivaPct) };
}

export function conceptoDraftDesde(c: {
  descripcion: string;
  cantidad?: number;
  precioUnitario?: number;
  importe: number;
  ivaPct: number;
}): FacturaConceptoDraft {
  return {
    descripcion: c.descripcion,
    cantidadStr: String(c.cantidad ?? 1),
    unitarioStr: formatCurrencyArFromNumber(c.precioUnitario ?? c.importe),
    ivaPctStr: String(c.ivaPct),
  };
}

export function cantidadDraft(d: FacturaConceptoDraft): number {
  const n = Number(d.cantidadStr.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function unitarioDraft(d: FacturaConceptoDraft): number {
  return parseCurrencyAr(d.unitarioStr) ?? 0;
}

export function ivaDraft(d: FacturaConceptoDraft, ivaPctDefault: number): number {
  return d.ivaPctStr.trim() === "" ? ivaPctDefault : Number(d.ivaPctStr);
}

/** Subtotal con IVA del renglón (para mostrar mientras se carga). */
export function subtotalConIvaDraft(d: FacturaConceptoDraft, ivaPctDefault: number): number {
  const neto = round2(cantidadDraft(d) * unitarioDraft(d));
  const iva = ivaDraft(d, ivaPctDefault);
  return round2(neto + round2((neto * (Number.isFinite(iva) ? iva : 0)) / 100));
}

/** Concepto completo (para totales y payload); null si está vacío o incompleto. */
export function conceptoDesdeDraft(
  d: FacturaConceptoDraft,
  ivaPctDefault: number,
): FacturaConcepto | null {
  const descripcion = d.descripcion.trim();
  const cantidad = cantidadDraft(d);
  const precioUnitario = unitarioDraft(d);
  const iva = ivaDraft(d, ivaPctDefault);
  const importe = round2(cantidad * precioUnitario);
  if (!descripcion || !(cantidad > 0) || !(importe > 0)) return null;
  if (!Number.isFinite(iva) || iva < 0 || iva > 100) return null;
  return { descripcion, cantidad, precioUnitario, importe, ivaPct: iva };
}

export function conceptosValidos(
  drafts: FacturaConceptoDraft[],
  ivaPctDefault: number,
): FacturaConcepto[] {
  return drafts
    .map((d) => conceptoDesdeDraft(d, ivaPctDefault))
    .filter((c): c is FacturaConcepto => c !== null);
}

/**
 * Índices de conceptos a medio cargar (algo escrito pero falta concepto, cantidad o monto
 * unitario > 0, o IVA válido). Un renglón sin concepto ni monto no cuenta: se descarta al
 * guardar.
 */
export function conceptosIncompletos(
  drafts: FacturaConceptoDraft[],
  ivaPctDefault: number,
): number[] {
  return drafts.flatMap((d, i) => {
    const vacio = !d.descripcion.trim() && !d.unitarioStr.trim();
    return !vacio && conceptoDesdeDraft(d, ivaPctDefault) === null ? [i] : [];
  });
}

/**
 * Gastos del viaje como conceptos (cantidad 1, unitario = monto del gasto): solo los de la
 * moneda de la factura, y solo si el cliente de la factura es el principal del viaje (en un
 * viaje con varios clientes los gastos se facturan una sola vez, al principal).
 */
export function conceptosDeGastosDelViaje(
  viaje: Viaje,
  clienteId: string,
  moneda: string,
  ivaPct: number,
): FacturaConceptoDraft[] {
  if (viaje.clienteId !== clienteId) return [];
  return (viaje.otrosGastos ?? [])
    .filter((g) => (Number(g.monto) || 0) > 0 && normalizeViajeMoneda(g.moneda) === moneda)
    .map((g) => ({
      descripcion: `${g.descripcion?.trim() || "Gasto"} (viaje #${numeroVisibleViaje(viaje)})`,
      cantidadStr: "1",
      unitarioStr: formatCurrencyArFromNumber(Number(g.monto)),
      ivaPctStr: String(ivaPct),
      viajeId: viaje.id,
    }));
}

/**
 * Al cambiar los viajes elegidos: saca los conceptos precargados de los viajes que ya no
 * están y agrega los gastos de los viajes nuevos. Lo que el usuario cargó o editó se respeta
 * (los de un viaje que sigue elegido no se vuelven a agregar).
 */
export function sincronizarConceptosConViajes(
  actuales: FacturaConceptoDraft[],
  viajeIdsAntes: string[],
  viajeIdsAhora: string[],
  viajes: Viaje[],
  clienteId: string,
  ivaPct: number,
): FacturaConceptoDraft[] {
  const ahora = new Set(viajeIdsAhora);
  const antes = new Set(viajeIdsAntes);
  const quedan = actuales.filter((c) => !c.viajeId || ahora.has(c.viajeId));
  const elegidos = viajes.filter((v) => ahora.has(v.id));
  const moneda = normalizeViajeMoneda(elegidos[0]?.monedaMonto);
  const nuevos = elegidos
    .filter((v) => !antes.has(v.id))
    .flatMap((v) => conceptosDeGastosDelViaje(v, clienteId, moneda, ivaPct));
  return [...quedan, ...nuevos];
}
