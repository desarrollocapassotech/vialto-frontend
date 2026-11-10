/**
 * Clases de un input con el borde en rojo si `error`: saca el `border-black/NN` de la
 * clase base (si quedaran los dos, el color depende del orden del CSS) y suma
 * `border-red-400`. Mismo criterio que `CiudadCombobox`.
 */
export function conBordeError(clase: string, error: boolean | undefined): string {
  if (!error) return clase;
  return `${clase.replace(/\bborder-black\/\d+\b/g, '').replace(/\s+/g, ' ').trim()} border-red-400`;
}
