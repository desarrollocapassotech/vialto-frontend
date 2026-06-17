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
  sortDir: 'asc',
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
    return sortDir === 'asc' ? `${base} (de vieja a nueva)` : `${base} (de nueva a vieja)`;
  }
  return sortDir === 'desc' ? `${base} (mayor primero)` : `${base} (menor primero)`;
}

function esCampoFecha(field: ViajeSortField): boolean {
  return field === 'fecha_carga' || field === 'fecha_descarga';
}

export function etiquetaDirDesc(field: ViajeSortField): string {
  return esCampoFecha(field) ? 'De nueva a vieja' : 'Mayor primero';
}

export function etiquetaDirAsc(field: ViajeSortField): string {
  return esCampoFecha(field) ? 'De vieja a nueva' : 'Menor primero';
}

export function appendViajeSortQuery(
  params: URLSearchParams,
  sortBy: ViajeSortField,
  sortDir: ViajeSortDir,
): void {
  params.set('sortBy', sortBy);
  params.set('sortDir', sortDir);
}
