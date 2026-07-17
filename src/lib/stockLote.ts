import { apiJson } from '@/lib/api';

/** Valor interno del select cuando el egreso sale de stock sin lote asignado. */
export const STOCK_SIN_LOTE_VALUE = '__sin_lote__';

export type LoteDisponible = {
  lote: string;
  cantidad1: number;
  cantidad2: number;
  fechaVencimiento: string | null;
};

export type LotesDisponiblesResponse = {
  lotes: LoteDisponible[];
  sinLote: { cantidad1: number; cantidad2: number } | null;
};

/** Convierte la selección del formulario al valor que espera la API (`null` = sin lote). */
export function loteEgresoParaApi(lote: string): string | null {
  if (lote === STOCK_SIN_LOTE_VALUE) return null;
  return lote;
}

export function loteEgresoSeleccionValida(lote: string): boolean {
  return lote === STOCK_SIN_LOTE_VALUE || lote.trim().length > 0;
}

export type SaldoLote = {
  bultos: number;
  sueltas: number;
  fechaVencimiento: string | null;
};

export function buildLotesUrl(
  base: string,
  productoId: string,
  clienteId: string,
  depositoId: string,
  presentacionId: string,
  tenantId?: string,
): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  parts.push(`productoId=${encodeURIComponent(productoId)}`);
  parts.push(`clienteId=${encodeURIComponent(clienteId)}`);
  parts.push(`depositoId=${encodeURIComponent(depositoId)}`);
  if (presentacionId) parts.push(`presentacionId=${encodeURIComponent(presentacionId)}`);
  return `${base}?${parts.join('&')}`;
}

/** Orden FEFO: vencimiento más próximo primero; sin vto al final. */
export function compareLotesFefo(
  a: { lote: string; fechaVencimiento: string | null },
  b: { lote: string; fechaVencimiento: string | null },
): number {
  if (a.fechaVencimiento && b.fechaVencimiento) {
    const byDate = a.fechaVencimiento.localeCompare(b.fechaVencimiento);
    if (byDate !== 0) return byDate;
  } else if (a.fechaVencimiento && !b.fechaVencimiento) {
    return -1;
  } else if (!a.fechaVencimiento && b.fechaVencimiento) {
    return 1;
  }
  return a.lote.localeCompare(b.lote, 'es');
}

export type LoteVencimientoNivel = 'vencido' | 'proximo' | 'ok' | null;

/** Umbral de aviso: 30 días antes del vencimiento. */
export const LOTE_VTO_PROXIMO_DIAS = 30;

/**
 * Clasifica la urgencia de un vencimiento respecto a hoy (inicio del día local).
 * `null` si no hay fecha.
 */
export function nivelVencimientoLote(
  fechaVencimiento: string | null | undefined,
  hoy = new Date(),
): LoteVencimientoNivel {
  if (!fechaVencimiento) return null;
  const raw = fechaVencimiento.trim();
  if (!raw) return null;
  const vto = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`);
  if (Number.isNaN(vto.getTime())) return null;

  const startHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const startVto = new Date(vto.getFullYear(), vto.getMonth(), vto.getDate());
  const diffDias = Math.round(
    (startVto.getTime() - startHoy.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (diffDias < 0) return 'vencido';
  if (diffDias <= LOTE_VTO_PROXIMO_DIAS) return 'proximo';
  return 'ok';
}

export async function fetchLotesDisponibles(
  getToken: () => Promise<string | null>,
  lotesBase: string,
  ctx: {
    productoId: string;
    clienteId: string;
    depositoId: string;
    presentacionId: string;
    tenantId?: string;
  },
): Promise<LotesDisponiblesResponse> {
  const url = buildLotesUrl(
    lotesBase,
    ctx.productoId,
    ctx.clienteId,
    ctx.depositoId,
    ctx.presentacionId,
    ctx.tenantId,
  );
  return apiJson<LotesDisponiblesResponse>(url, getToken);
}

/** Saldo disponible de un lote (o sin lote) para refrescar el egreso tras una división. */
export async function fetchSaldoLote(
  getToken: () => Promise<string | null>,
  lotesBase: string,
  ctx: {
    productoId: string;
    clienteId: string;
    depositoId: string;
    presentacionId: string;
    lote: string;
    tenantId?: string;
  },
): Promise<SaldoLote | null> {
  if (!loteEgresoSeleccionValida(ctx.lote)) return null;
  const url = buildLotesUrl(
    lotesBase,
    ctx.productoId,
    ctx.clienteId,
    ctx.depositoId,
    ctx.presentacionId,
    ctx.tenantId,
  );
  const data = await apiJson<LotesDisponiblesResponse>(url, getToken);
  if (ctx.lote === STOCK_SIN_LOTE_VALUE) {
    if (!data.sinLote) return null;
    return {
      bultos: data.sinLote.cantidad1,
      sueltas: data.sinLote.cantidad2,
      fechaVencimiento: null,
    };
  }
  const item = data.lotes.find((l) => l.lote === ctx.lote);
  if (!item) return null;
  return {
    bultos: item.cantidad1,
    sueltas: item.cantidad2,
    fechaVencimiento: item.fechaVencimiento,
  };
}

/** Bultos del lote que aún se pueden desarmar (descontando los ya reservados en la línea). */
export function egresoBultosDisponiblesParaFraccionar(
  loteStock: { bultos: number; sueltas: number },
  bultosReservados = '',
): number {
  return Math.max(0, loteStock.bultos - (parseFloat(bultosReservados) || 0));
}

/** Máximo de sueltas obtenibles desarmando todos los bultos del lote. */
export function egresoSueltasAlcanzables(
  loteStock: { bultos: number; sueltas: number },
  unidadesPorBulto: number,
  bultosReservados = '',
): number {
  const bultosLibres = egresoBultosDisponiblesParaFraccionar(loteStock, bultosReservados);
  return loteStock.sueltas + bultosLibres * unidadesPorBulto;
}

/**
 * Indica si conviene ofrecer desarmar bultos para obtener sueltas en el egreso.
 * Se muestra cuando las sueltas pedidas superan las sueltas sueltas del lote y aún hay
 * bultos remanentes (el usuario puede fraccionar de a uno hasta cubrir o agotar bultos).
 */
export function egresoOfreceFraccionar(
  loteStock: { bultos: number; sueltas: number } | null,
  sueltasIngresadas: string,
  unidadesPorBulto: number,
  bultosReservados = '',
): boolean {
  if (!loteStock || unidadesPorBulto <= 0) return false;
  if (egresoBultosDisponiblesParaFraccionar(loteStock, bultosReservados) <= 0) {
    return false;
  }
  const pedidas = parseFloat(sueltasIngresadas) || 0;
  if (pedidas <= 0) {
    return loteStock.sueltas <= 0;
  }
  return pedidas > loteStock.sueltas;
}

/** Las sueltas pedidas superan el stock suelto pero aún se pueden desarmar bultos. */
export function egresoPendienteFraccionar(
  loteStock: { bultos: number; sueltas: number } | null,
  sueltasIngresadas: string,
  unidadesPorBulto: number,
  bultosReservados = '',
): boolean {
  if (!loteStock) return false;
  const pedidas = parseFloat(sueltasIngresadas) || 0;
  return (
    pedidas > loteStock.sueltas &&
    egresoOfreceFraccionar(
      loteStock,
      sueltasIngresadas,
      unidadesPorBulto,
      bultosReservados,
    )
  );
}
