/**
 * Las etiquetas de origen/destino suelen ser "Ciudad, provincia" (AR) o "Ciudad, depto, país" (UY).
 * Para tablas, mostrar solo el nombre de la ciudad (segmento antes de la primera coma).
 */
export function soloCiudadDesdeEtiquetaUbicacion(raw: string | null | undefined): string {
  if (raw == null) return '—';
  const t = raw.trim();
  if (!t) return '—';
  const i = t.indexOf(',');
  if (i === -1) return t;
  const city = t.slice(0, i).trim();
  return city || '—';
}
