import type { PaginatedMeta } from '@/types/api';

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
