import { useState } from "react";

/** Tamaño de página de las tablas del dashboard. */
export const TAMANO_PAGINA_DASHBOARD = 5;

/**
 * Paginación en el navegador de una lista que ya está entera en memoria (tablas del
 * dashboard). Si la lista se achica, la página se ajusta sola a la última que existe.
 * Se usa con `PaginacionCompacta`.
 */
export function usePaginaLocal<T>(items: readonly T[], tamano = TAMANO_PAGINA_DASHBOARD) {
  const [pagina, setPagina] = useState(1);
  const totalPaginas = Math.max(1, Math.ceil(items.length / tamano));
  const actual = Math.min(Math.max(1, pagina), totalPaginas);
  return {
    visibles: items.slice((actual - 1) * tamano, actual * tamano),
    pagina: actual,
    totalPaginas,
    total: items.length,
    tamano,
    setPagina,
  };
}

export type PaginaLocal = Omit<ReturnType<typeof usePaginaLocal>, "visibles">;
