import { apiJson } from '@/lib/api';
import {
  sortViajesListado,
  type ViajeSortDir,
  type ViajeSortField,
} from '@/lib/viajesOrdenamiento';
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

/** Quita sort de la URL de escaneo: el orden lo define el cliente al paginar. */
function listBaseSinOrden(listBaseUrl: string): string {
  const q = listBaseUrl.indexOf('?');
  if (q === -1) return listBaseUrl.endsWith('&') ? listBaseUrl : `${listBaseUrl}?`;
  const params = new URLSearchParams(listBaseUrl.slice(q + 1).replace(/&$/, ''));
  params.delete('sortBy');
  params.delete('sortDir');
  const rest = params.toString();
  const prefix = listBaseUrl.slice(0, q + 1);
  return rest ? `${prefix}${rest}&` : prefix;
}

async function recolectarViajesPaginados(
  listBaseUrl: string,
  getToken: () => Promise<string | null>,
): Promise<Viaje[]> {
  const base = listBaseSinOrden(listBaseUrl);
  const todos: Viaje[] = [];
  let scanPage = 1;
  while (scanPage <= MAX_PAGINAS_CONTEO) {
    const data = await apiJson<ViajesPaginatedResponse>(
      urlPaginaConteo(base, scanPage),
      getToken,
    );
    todos.push(...data.items);
    if (!data.meta.hasNext) break;
    scanPage += 1;
  }
  return todos;
}

/**
 * Orden global en cliente (misma estrategia que filtro pago transportista).
 * Necesario cuando el backend no aplica bien sortDir o sortBy de fechas.
 */
export async function listarViajesOrdenadosClienteDesdeApi(
  listBaseUrl: string,
  page: number,
  pageSize: number,
  sortBy: ViajeSortField,
  sortDir: ViajeSortDir,
  getToken: () => Promise<string | null>,
): Promise<{ items: Viaje[]; meta: PaginatedMeta }> {
  const pageSizeApi = pageSizeApiValido(pageSize);
  const pageApi = Math.max(1, Math.floor(page));
  const todos = await recolectarViajesPaginados(listBaseUrl, getToken);
  const ordenados = sortViajesListado(todos, sortBy, sortDir);
  const totalReal = ordenados.length;
  const startIndex = (pageApi - 1) * pageSizeApi;
  return {
    items: ordenados.slice(startIndex, startIndex + pageSizeApi),
    meta: metaPaginacionAjustada(totalReal, pageApi, pageSizeApi),
  };
}

/** true si el listado debe ordenarse en cliente recorriendo todas las páginas. */
export function viajeListadoRequiereOrdenCliente(
  sortBy: ViajeSortField,
  sortDir: ViajeSortDir,
): boolean {
  return sortDir === 'desc' || sortBy !== 'fecha_carga';
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

/** Misma regla que el conteo de chips: recorre el listado paginado y filtra en cliente. */
export async function listarViajesPorPagoTransportistaDesdeApi(
  listBaseUrl: string,
  filtro: 'sin_pagar' | 'pagado',
  page: number,
  pageSize: number,
  sortBy: ViajeSortField,
  sortDir: ViajeSortDir,
  getToken: () => Promise<string | null>,
): Promise<{ items: Viaje[]; meta: PaginatedMeta }> {
  const pageSizeApi = pageSizeApiValido(pageSize);
  const pageApi = Math.max(1, Math.floor(page));
  const allMatches: Viaje[] = [];
  let scanPage = 1;
  const base = listBaseSinOrden(listBaseUrl);

  while (scanPage <= MAX_PAGINAS_CONTEO) {
    const data = await apiJson<ViajesPaginatedResponse>(
      urlPaginaConteo(base, scanPage),
      getToken,
    );
    allMatches.push(...filtrarViajesPorPagoTransportista(data.items, filtro));
    if (!data.meta.hasNext) break;
    scanPage += 1;
  }

  const ordenados = sortViajesListado(allMatches, sortBy, sortDir);
  const totalReal = ordenados.length;
  const startIndex = (pageApi - 1) * pageSizeApi;
  return {
    items: ordenados.slice(startIndex, startIndex + pageSizeApi),
    meta: metaPaginacionAjustada(totalReal, pageApi, pageSizeApi),
  };
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
