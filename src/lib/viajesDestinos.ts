import {
  esEtiquetaCiudadValida,
  inferirPaisDesdeUbicacion,
  soloCiudadDesdeEtiquetaUbicacion,
  type PaisCodigo,
} from '@/lib/ciudades';
import type { Viaje } from '@/types/api';

export type ViajeDestinoRowDraft = {
  pais: PaisCodigo;
  etiqueta: string;
};

export type ViajeDestinoApiItem = { etiqueta: string };

export function emptyDestinoRow(pais: PaisCodigo = 'AR'): ViajeDestinoRowDraft {
  return { pais, etiqueta: '' };
}

/** Destinos del viaje en orden operativo (fallback al campo legacy `destino`). */
export function etiquetasDestinosDesdeViaje(
  v: Pick<Viaje, 'destino' | 'destinosViaje'>,
): string[] {
  const rows = v.destinosViaje ?? [];
  if (rows.length > 0) {
    return [...rows]
      .sort((a, b) => a.orden - b.orden)
      .map((x) => x.etiqueta.trim())
      .filter(Boolean);
  }
  const legacy = v.destino?.trim();
  return legacy ? [legacy] : [];
}

/** Filas de formulario para crear/editar (al menos una fila). */
export function destinosRowsDesdeViaje(v: Pick<Viaje, 'destino' | 'destinosViaje'>): ViajeDestinoRowDraft[] {
  const etiquetas = etiquetasDestinosDesdeViaje(v);
  if (etiquetas.length > 0) {
    return etiquetas.map((etiqueta) => ({
      pais: inferirPaisDesdeUbicacion(etiqueta),
      etiqueta,
    }));
  }
  return [emptyDestinoRow()];
}

/** Payload API: orden del array = orden de la ruta. Omite filas vacías. */
export function destinosApiDesdeRows(rows: ViajeDestinoRowDraft[]): ViajeDestinoApiItem[] {
  const out: ViajeDestinoApiItem[] = [];
  for (const row of rows) {
    const etiqueta = row.etiqueta.trim();
    if (etiqueta) out.push({ etiqueta });
  }
  return out;
}

/** Texto de ruta para listados: «Origen → Destino 1 → Destino 2». */
export function textoRutaViaje(
  origen: string | null | undefined,
  destinos: string[],
): string {
  const partes: string[] = [];
  const o = origen?.trim();
  if (o) partes.push(soloCiudadDesdeEtiquetaUbicacion(o) || o);
  for (const d of destinos) {
    const t = d.trim();
    if (t) partes.push(soloCiudadDesdeEtiquetaUbicacion(t) || t);
  }
  return partes.length > 0 ? partes.join(' → ') : '—';
}

export async function validarDestinosRows(
  rows: ViajeDestinoRowDraft[],
): Promise<{ ok: true; destinos: ViajeDestinoApiItem[] } | { ok: false; message: string }> {
  if (!rows[0]?.etiqueta.trim()) {
    return { ok: false, message: 'Ingresá el destino 1.' };
  }
  const destinos = destinosApiDesdeRows(rows);
  if (destinos.length === 0) {
    return { ok: false, message: 'Ingresá al menos un destino.' };
  }
  for (const row of rows) {
    const etiqueta = row.etiqueta.trim();
    if (!etiqueta) continue;
    const ok = await esEtiquetaCiudadValida(row.pais, etiqueta);
    if (!ok) {
      return {
        ok: false,
        message:
          'Todos los destinos deben elegirse de la lista de ciudades (no se admite texto libre).',
      };
    }
  }
  return { ok: true, destinos };
}
