import type { PaginatedResponse } from '@/types/api';

/** Acepta respuesta paginada `{ items, meta }` o un array plano (endpoints legacy). */
export function paginatedItems<T>(data: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(data) ? data : (data.items ?? []);
}
