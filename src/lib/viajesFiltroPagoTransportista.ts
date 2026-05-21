import { apiJson } from '@/lib/api';
import { viajeCoincideFiltroPagoTransportista } from '@/lib/viajesTransportistaPagos';
import type { PaginatedMeta, Viaje } from '@/types/api';

/** Valores de `pagoTransportista` en GET /api/viajes/paginated (y platform). */
export const VIAJE_PAGO_TRANSPORTISTA_FILTROS = ['sin_pagar', 'pagado'] as const;

export type ViajePagoTransportistaFiltro = (typeof VIAJE_PAGO_TRANSPORTISTA_FILTROS)[number] | '';

export const VIAJE_PAGO_TRANSPORTISTA_QUERY = 'pagoTransportista';

const MAX_PAGINAS_CONTEO = 50;
const PAGE_SIZE_CONTEO = 100;

type ViajesPaginatedResponse = { items: Viaje[]; meta: PaginatedMeta };

export function pageSizeApiValido(n: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return 10;
  return Math.min(100, v);
}

export function esFiltroPagoTransportistaValido(v: string): v is ViajePagoTransportistaFiltro {
  const s = v.trim();
  if (!s) return true;
  return (VIAJE_PAGO_TRANSPORTISTA_FILTROS as readonly string[]).includes(s);
}

/** Asegura que la página mostrada coincida con el badge de ganancia bruta. */
export function filtrarViajesPorPagoTransportista(
  items: Viaje[],
  filtro: 'sin_pagar' | 'pagado',
): Viaje[] {
  return items.filter((v) => viajeCoincideFiltroPagoTransportista(v, filtro));
}

function urlPaginaConteo(base: string, page: number): string {
  const sep = base.endsWith('?') || base.endsWith('&') ? '' : base.includes('?') ? '&' : '?';
  return `${base}${sep}page=${page}&pageSize=${PAGE_SIZE_CONTEO}`;
}

/**
 * Conteo para chips: recorre el listado con `pagoTransportista` en la API y valida
 * cada ítem con la misma regla que el badge (precio acordado > 0 y saldo real).
 */
export async function contarViajesPagoTransportistaDesdeApi(
  listBaseUrl: string,
  filtro: 'sin_pagar' | 'pagado',
  getToken: () => Promise<string | null>,
): Promise<number> {
  let page = 1;
  let total = 0;
  while (page <= MAX_PAGINAS_CONTEO) {
    const data = await apiJson<ViajesPaginatedResponse>(
      urlPaginaConteo(listBaseUrl, page),
      getToken,
    );
    total += filtrarViajesPorPagoTransportista(data.items, filtro).length;
    if (!data.meta.hasNext) break;
    page += 1;
  }
  return total;
}

export function metaPaginacionAjustada(
  totalReal: number,
  page: number,
  pageSize: number,
): PaginatedMeta {
  const totalPages = Math.max(1, Math.ceil(totalReal / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    page: safePage,
    pageSize,
    total: totalReal,
    totalPages,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  };
}
