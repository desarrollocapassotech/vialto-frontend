import { apiJson } from '@/lib/api';
import type { PaginatedMeta } from '@/types/api';

/** Máximo que acepta el backend en `pageSize` de los endpoints `/paginated` (`@Max(100)`). */
const PAGE_SIZE_MAXIMO_API = 100;

/**
 * Trae TODOS los ítems de un endpoint `/paginated`, recorriendo las páginas de a 100
 * (el máximo del backend). Para cuando la pantalla necesita la lista completa (ej. elegir
 * viajes a liquidar) y no una página: pedir solo `page=1&pageSize=100` cortaba en silencio
 * los ítems que pasaban de 100. `path` va sin `page`/`pageSize`.
 */
export async function apiJsonTodasLasPaginas<T>(
  path: string,
  getToken: () => Promise<string | null>,
): Promise<T[]> {
  const sep = path.includes('?') ? '&' : '?';
  const url = (page: number) => `${path}${sep}page=${page}&pageSize=${PAGE_SIZE_MAXIMO_API}`;
  const primera = await apiJson<{ items: T[]; meta?: PaginatedMeta }>(url(1), getToken);
  const totalPages = primera.meta?.totalPages ?? 1;
  if (totalPages <= 1) return primera.items ?? [];
  const resto = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) =>
      apiJson<{ items: T[] }>(url(i + 2), getToken),
    ),
  );
  return [primera.items ?? [], ...resto.map((r) => r.items ?? [])].flat();
}

export const LISTADO_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export function pageSizeListadoValido(n: number): number {
  if (!Number.isFinite(n) || n < 1) return LISTADO_PAGE_SIZE_OPTIONS[0];
  return Math.min(50, Math.max(1, Math.floor(n)));
}

/** Páginas numéricas a mostrar alrededor de la actual (máx. `window`). */
export function paginasVisibles(current: number, totalPages: number, window = 5): number[] {
  if (totalPages <= 0) return [];
  if (totalPages === 1) return [1];
  const w = Math.max(1, window);
  const half = Math.floor(w / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(totalPages, start + w - 1);
  start = Math.max(1, end - w + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function metaPaginacionCliente(
  total: number,
  page: number,
  pageSize: number,
): PaginatedMeta {
  const safePageSize = pageSizeListadoValido(pageSize);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  return {
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  };
}

export function slicePaginaCliente<T>(items: T[], page: number, pageSize: number): T[] {
  const meta = metaPaginacionCliente(items.length, page, pageSize);
  const start = (meta.page - 1) * meta.pageSize;
  return items.slice(start, start + meta.pageSize);
}
