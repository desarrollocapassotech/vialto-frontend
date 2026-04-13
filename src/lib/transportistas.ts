import type { Transportista } from '@/types/api';

export function mapTransportistaNombres(list: Transportista[]): Map<string, string> {
  return new Map(list.map((t) => [t.id, t.nombre]));
}

/** Etiqueta para listados: flota propia o nombre del transportista. */
export function labelAsignacionTransportista(
  transportistaId: string | null | undefined,
  nombresPorId: Map<string, string>,
): string {
  if (!transportistaId) return 'Flota propia';
  return nombresPorId.get(transportistaId) ?? '—';
}
