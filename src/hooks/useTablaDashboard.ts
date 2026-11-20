import { useMemo, useRef } from "react";
import {
  compararValorOrden,
  useOrdenColumna,
  type TipoOrden,
  type ValorOrden,
} from "@/lib/ordenListado";
import { usePaginaLocal } from "./usePaginaLocal";

/** Cómo ordena una columna: qué valor de la fila compara y de qué tipo es (para el tooltip). */
export type ColumnaOrdenable<T> = { valor: (fila: T) => ValorOrden; tipo?: TipoOrden };

/**
 * Tabla del dashboard: orden con click en el título de cada columna (mismo criterio que
 * todas las grillas, `lib/ordenListado.ts`) + paginación de a 5. Ordena la lista entera
 * y después pagina; al cambiar el orden vuelve a la página 1. Sin orden elegido, queda el
 * orden en que vienen los datos.
 *
 * Uso: `const t = useTablaDashboard(items, { fecha: { valor: (x) => x.fecha, tipo: "fecha" } })`;
 * en el `<th>`, `<TituloOrdenable title="Fecha" orden={t.ordenColumna("fecha")} />`; filas
 * con `t.visibles` y debajo `<PaginacionCompacta paginacion={t.paginacion} />`.
 */
export function useTablaDashboard<T, F extends string>(
  items: readonly T[],
  columnas: Record<F, ColumnaOrdenable<T>>,
) {
  const irAPrimeraPagina = useRef<(n: number) => void>(() => {});
  const tipos = Object.fromEntries(
    Object.entries(columnas).map(([k, c]) => [k, (c as ColumnaOrdenable<T>).tipo ?? "texto"]),
  ) as Partial<Record<F, TipoOrden>>;
  const { orden, ordenColumna } = useOrdenColumna<F>(() => irAPrimeraPagina.current(1), tipos);

  const ordenados = useMemo(() => {
    if (!orden) return items;
    const col = columnas[orden.by];
    if (!col) return items;
    // Desempate por la posición original: el orden es estable entre clicks.
    return items
      .map((fila, i) => ({ fila, i, v: col.valor(fila) }))
      .sort((a, b) => compararValorOrden(a.v, b.v, orden.dir, () => a.i - b.i))
      .map((x) => x.fila);
    // `columnas` se arma en cada render; el orden solo cambia con los datos o el criterio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, orden]);

  const { visibles, ...paginacion } = usePaginaLocal(ordenados);
  irAPrimeraPagina.current = paginacion.setPagina;

  return { visibles, paginacion, ordenColumna };
}
