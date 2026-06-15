import type { Transportista } from '@/types/api';

export function mapTransportistaNombres(list: Transportista[]): Map<string, string> {
  return new Map(list.map((t) => [t.id, t.nombre]));
}

/** Etiqueta para listados: sin asignar, o nombre del transportista externo. */
export function labelAsignacionTransportista(
  transportistaId: string | null | undefined,
  nombresPorId: Map<string, string>,
): string {
  if (!transportistaId?.trim()) return '—';
  return nombresPorId.get(transportistaId) ?? '—';
}
