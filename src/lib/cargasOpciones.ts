import type { Carga, Viaje } from '@/types/api';

export type OpcionCarga = {
  id: string;
  nombre: string;
  activo: boolean;
  unidadMedida: string | null;
};

/** IDs de carga del viaje en orden guardado. */
export function cargaIdsOrdenadosDesdeViaje(v: Viaje): string[] {
  const rows = v.cargasViaje ?? [];
  if (!rows.length) return [];
  return [...rows]
    .sort((a, b) => a.orden - b.orden)
    .map((x) => x.cargaId)
    .filter(Boolean);
}

/** Catálogo activo + cargas ya vinculadas al viaje si quedaron inactivas (para no perder selección al editar). */
export function mergeOpcionesCarga(
  activos: Carga[],
  viaje?: Viaje | null,
): OpcionCarga[] {
  const m = new Map<string, OpcionCarga>();
  for (const t of activos) {
    m.set(t.id, {
      id: t.id,
      nombre: t.nombre,
      activo: t.activo,
      unidadMedida: t.unidadMedida,
    });
  }
  const desdeViaje = viaje?.cargasViaje?.length
    ? [...viaje.cargasViaje].sort((a, b) => a.orden - b.orden)
    : [];
  for (const row of desdeViaje) {
    const cur = row.carga;
    if (cur?.id && !m.has(cur.id)) {
      m.set(cur.id, {
        id: cur.id,
        nombre: cur.activo ? cur.nombre : `${cur.nombre} (inactivo)`,
        activo: cur.activo,
        unidadMedida: cur.unidadMedida,
      });
    }
  }
  return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
