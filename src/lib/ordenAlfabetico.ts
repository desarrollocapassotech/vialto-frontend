/**
 * Orden alfabético de las opciones de los selects del sistema (regla global: todo select
 * se muestra ordenado A→Z). Ignora mayúsculas y acentos ("Álvarez" va con la A, no al
 * final) y compara números como números ("Camión 2" antes que "Camión 10").
 *
 * "Otro"/"Otra"/"Otros" van siempre al final. Las opciones fijas de arriba ("Todos",
 * "Elegí…", "Sin asignar") no pasan por acá: se renderizan aparte, antes de la lista.
 *
 * Excepción: listas con un orden propio que no es alfabético (etapas/estados de un
 * circuito, alícuotas, meses, tamaños de página, lotes por vencimiento) se dejan en
 * su orden natural.
 */
const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

const AL_FINAL = /^otr[oa]s?$/i;

export function compararAlfabetico(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const x = (a ?? "").trim();
  const y = (b ?? "").trim();
  const finalX = AL_FINAL.test(x);
  const finalY = AL_FINAL.test(y);
  if (finalX !== finalY) return finalX ? 1 : -1;
  return collator.compare(x, y);
}

/** Copia ordenada A→Z según `label` (no muta el array original). */
export function ordenarAlfabetico<T>(
  items: readonly T[],
  label: (item: T) => string | null | undefined,
): T[] {
  return [...items].sort((a, b) => compararAlfabetico(label(a), label(b)));
}
