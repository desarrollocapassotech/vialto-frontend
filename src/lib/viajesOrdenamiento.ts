export const VIAJE_SORT_FIELDS = [
  'fecha_carga',
  'fecha_descarga',
  'monto',
  'ganancia_bruta',
] as const;

export type ViajeSortField = (typeof VIAJE_SORT_FIELDS)[number];
export type ViajeSortDir = 'asc' | 'desc';

export const VIAJE_SORT_DEFAULT: { sortBy: ViajeSortField; sortDir: ViajeSortDir } = {
  sortBy: 'fecha_carga',
  sortDir: 'desc',
};

export const VIAJE_SORT_LABELS: Record<ViajeSortField, string> = {
  fecha_carga: 'Fecha de carga',
  fecha_descarga: 'Fecha de descarga',
  monto: 'Monto a facturar',
  ganancia_bruta: 'Ganancia bruta',
};

export function etiquetaViajeOrdenamiento(sortBy: ViajeSortField, sortDir: ViajeSortDir): string {
  const base = VIAJE_SORT_LABELS[sortBy];
  if (sortBy === 'fecha_carga' || sortBy === 'fecha_descarga') {
    return sortDir === 'desc' ? `${base} (más nuevo primero)` : `${base} (más antiguo primero)`;
  }
  return sortDir === 'desc' ? `${base} (mayor primero)` : `${base} (menor primero)`;
}

function esCampoFecha(field: ViajeSortField): boolean {
  return field === 'fecha_carga' || field === 'fecha_descarga';
}

export function etiquetaDirDesc(field: ViajeSortField): string {
  return esCampoFecha(field) ? 'Más reciente primero' : 'Mayor primero';
}

export function etiquetaDirAsc(field: ViajeSortField): string {
  return esCampoFecha(field) ? 'Más antiguo primero' : 'Menor primero';
}

export function appendViajeSortQuery(
  params: URLSearchParams,
  sortBy: ViajeSortField,
  sortDir: ViajeSortDir,
): void {
  params.set('sortBy', sortBy);
  params.set('sortDir', sortDir);
}
