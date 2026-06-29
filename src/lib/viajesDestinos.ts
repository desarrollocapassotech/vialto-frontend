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

/** Última parada de la ruta (campo legacy `destino` del viaje). */
export function ultimaEtiquetaDestino(destinos: ViajeDestinoApiItem[]): string | undefined {
  return destinos.length > 0 ? destinos[destinos.length - 1].etiqueta : undefined;
}

/**
 * Body para POST/PATCH: `destinos[]` (ruta completa) y `destino` (última parada, legacy).
 * El backend VT-57 sincroniza `destino` con el último ítem de `destinos`.
 */
export function destinosPayloadParaApi(
  destinos: ViajeDestinoApiItem[],
): { destinos: ViajeDestinoApiItem[]; destino: string } {
  const ultima = ultimaEtiquetaDestino(destinos);
  if (!ultima) {
    throw new Error('destinosPayloadParaApi: sin destinos');
  }
  return { destinos, destino: ultima };
}

/** Si la API no devolvió `destinosViaje`, reconstruir desde lo enviado o el legacy `destino`. */
export function viajeConDestinosEnRespuesta(
  viaje: Viaje,
  destinosGuardados: ViajeDestinoApiItem[],
): Viaje {
  const esperados = destinosGuardados.length;
  if (esperados === 0) return viaje;
  const actuales = etiquetasDestinosDesdeViaje(viaje);
  if (actuales.length >= esperados) return viaje;
  return {
    ...viaje,
    destino: ultimaEtiquetaDestino(destinosGuardados) ?? viaje.destino,
    destinosViaje: destinosGuardados.map((d, orden) => ({
      id: viaje.destinosViaje?.[orden]?.id ?? `local-${orden}`,
      orden,
      etiqueta: d.etiqueta,
    })),
  };
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
): Promise<
  | { ok: true; destinos: ViajeDestinoApiItem[] }
  | { ok: false; message: string; rowErrors: Record<number, string> }
> {
  if (!rows[0]?.etiqueta.trim()) {
    const msg = 'Ingresá el destino 1.';
    return { ok: false, message: msg, rowErrors: { 0: msg } };
  }
  const destinos = destinosApiDesdeRows(rows);
  if (destinos.length === 0) {
    const msg = 'Ingresá al menos un destino.';
    return { ok: false, message: msg, rowErrors: { 0: msg } };
  }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const etiqueta = row.etiqueta.trim();
    if (!etiqueta) continue;
    const ok = await esEtiquetaCiudadValida(row.pais, etiqueta);
    if (!ok) {
      const msg = 'Elegí el destino de la lista de ciudades (no se admite texto libre).';
      return {
        ok: false,
        message:
          'Todos los destinos deben elegirse de la lista de ciudades (no se admite texto libre).',
        rowErrors: { [i]: msg },
      };
    }
  }
  return { ok: true, destinos };
}
