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

function buildLotesUrl(
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

/** Indica si conviene ofrecer desarmar bultos para obtener sueltas en el egreso. */
export function egresoOfreceFraccionar(
  loteStock: { bultos: number; sueltas: number } | null,
  sueltasIngresadas: string,
  unidadesPorBulto: number,
): boolean {
  if (!loteStock || unidadesPorBulto <= 0 || loteStock.bultos <= 0) return false;
  const pedidas = parseFloat(sueltasIngresadas) || 0;
  if (pedidas > loteStock.sueltas) return true;
  return loteStock.sueltas === 0;
}
