import { gananciaBrutaValorOrdenable } from '@/lib/viajesGananciaBruta';
import type { Viaje } from '@/types/api';

const TZ_LISTADOS_AR = 'America/Argentina/Buenos_Aires';

function fechaSortKeyArgentina(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleString('sv-SE', {
      timeZone: TZ_LISTADOS_AR,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(' ', 'T');
}

function compareNullableFechaAr(
  aIso: string | null | undefined,
  bIso: string | null | undefined,
  dir: ViajeSortDir,
  tieBreak: () => number,
): number {
  const keyA = fechaSortKeyArgentina(aIso);
  const keyB = fechaSortKeyArgentina(bIso);
  if (keyA == null && keyB == null) return tieBreak();
  if (keyA == null) return 1;
  if (keyB == null) return -1;
  if (keyA === keyB) return tieBreak();
  const mult = dir === 'asc' ? 1 : -1;
  return keyA < keyB ? -mult : mult;
}

function compareNullableNumber(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: ViajeSortDir,
  tieBreak: () => number,
): number {
  const na = a == null || Number.isNaN(Number(a)) ? null : Number(a);
  const nb = b == null || Number.isNaN(Number(b)) ? null : Number(b);
  if (na == null && nb == null) return tieBreak();
  if (na == null) return 1;
  if (nb == null) return -1;
  if (na === nb) return tieBreak();
  const mult = dir === 'asc' ? 1 : -1;
  return (na - nb) * mult;
}

/** Ordena en cliente con la misma lógica que el backend (filtro pago transportista). */
export function sortViajesListado(
  items: Viaje[],
  sortBy: ViajeSortField,
  sortDir: ViajeSortDir,
): Viaje[] {
  const tie = (a: Viaje, b: Viaje) => a.id.localeCompare(b.id);
  return [...items].sort((a, b) => {
    switch (sortBy) {
      case 'fecha_carga':
        return compareNullableFechaAr(a.fechaCarga, b.fechaCarga, sortDir, () => tie(a, b));
      case 'fecha_descarga':
        return compareNullableFechaAr(a.fechaDescarga, b.fechaDescarga, sortDir, () => tie(a, b));
      case 'monto':
        return compareNullableNumber(a.monto, b.monto, sortDir, () => tie(a, b));
      case 'ganancia_bruta':
        return compareNullableNumber(
          gananciaBrutaValorOrdenable(a),
          gananciaBrutaValorOrdenable(b),
          sortDir,
          () => tie(a, b),
        );
      default:
        return tie(a, b);
    }
  });
}

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
