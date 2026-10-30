import { useState } from "react";
import type { OrdenColumna } from "@/components/viajes/ViajesListadoHeaderFiltro";

/**
 * Orden de grillas por columna (click en el título). Espejo de
 * `shared/util/orden-listado.util.ts` del backend: si cambia el criterio, cambiarlo
 * en los dos lados.
 */

export type OrdenDir = "asc" | "desc";
export type ValorOrden = string | number | null | undefined;
/** Qué muestra la columna: define cómo se lee el sentido del orden en el tooltip. */
export type TipoOrden = "texto" | "numero" | "fecha";

/** "A a Z" / "menor a mayor" / "más antigua a más reciente" (y al revés con `desc`). */
export function etiquetaDirOrden(tipo: TipoOrden, dir: OrdenDir): string {
  switch (tipo) {
    case "numero":
      return dir === "asc" ? "menor a mayor" : "mayor a menor";
    case "fecha":
      return dir === "asc"
        ? "más antigua a más reciente"
        : "más reciente a más antigua";
    default:
      return dir === "asc" ? "A a Z" : "Z a A";
  }
}

const collatorEs = new Intl.Collator("es", { sensitivity: "base", numeric: true });

function vacio(v: ValorOrden): boolean {
  if (v == null) return true;
  if (typeof v === "number") return !Number.isFinite(v);
  return !v.trim();
}

/**
 * Texto sin mayúsculas ni acentos y con números como números ("CP 2" < "CP 10");
 * números como números. Vacíos siempre al final, en los dos sentidos.
 */
export function compararValorOrden(
  a: ValorOrden,
  b: ValorOrden,
  dir: OrdenDir,
  tieBreak: () => number = () => 0,
): number {
  const va = vacio(a);
  const vb = vacio(b);
  if (va && vb) return tieBreak();
  if (va) return 1;
  if (vb) return -1;
  const cmp =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : collatorEs.compare(String(a).trim(), String(b).trim());
  if (cmp === 0) return tieBreak();
  return dir === "asc" ? cmp : -cmp;
}

/** Ordena por varias claves en orden (la 2da desempata la 1ra, etc.), y al final por id. */
export function ordenarPorClaves<T extends { id: string }>(
  filas: readonly T[],
  claves: (fila: T) => ValorOrden[],
  dir: OrdenDir,
): T[] {
  const conClaves = filas.map((fila) => ({ fila, claves: claves(fila) }));
  conClaves.sort((a, b) => {
    const comparar = (i: number): number =>
      i >= a.claves.length
        ? a.fila.id.localeCompare(b.fila.id)
        : compararValorOrden(a.claves[i], b.claves[i], dir, () => comparar(i + 1));
    return comparar(0);
  });
  return conClaves.map((x) => x.fila);
}

/**
 * Estado del orden por columna de una grilla. `orden = null` = sin orden de columna
 * (la grilla usa su orden de siempre). `onCambio` corre en cada cambio (ej. volver a
 * la página 1). `tipos`: tipo de cada columna para el tooltip (default texto).
 */
export function useOrdenColumna<F extends string>(
  onCambio?: () => void,
  tipos?: Partial<Record<F, TipoOrden>>,
) {
  const [orden, setOrden] = useState<{ by: F; dir: OrdenDir } | null>(null);

  function cambiar(next: { by: F; dir: OrdenDir } | null) {
    setOrden(next);
    onCambio?.();
  }

  /** Props `orden` de `ViajesListadoHeaderFiltro` / `TituloOrdenable` para una columna. */
  function ordenColumna(field: F, disabled?: boolean): OrdenColumna {
    const activo = orden?.by === field;
    return {
      dir: activo ? orden.dir : null,
      tipo: tipos?.[field],
      disabled,
      onClick: () =>
        cambiar({ by: field, dir: activo && orden.dir === "asc" ? "desc" : "asc" }),
      onClear: () => cambiar(null),
    };
  }

  return { orden, ordenColumna };
}
