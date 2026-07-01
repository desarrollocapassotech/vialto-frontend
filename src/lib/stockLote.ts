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
