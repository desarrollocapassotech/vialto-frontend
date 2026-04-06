import { buscarCiudades } from './buscarCiudades';
import type { PaisCodigo } from './types';

function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * Comprueba que el texto coincida con alguna opción devuelta por el buscador del país
 * (misma etiqueta que al elegir de la lista).
 */
export async function esEtiquetaCiudadValida(
  pais: PaisCodigo,
  label: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const trimmed = label.trim();
  if (trimmed.length < 2) return false;

  const nTarget = norm(trimmed);
  const primera = trimmed.split(',')[0]?.trim() ?? trimmed;
  const queries =
    primera.length >= 2 && primera !== trimmed ? [primera, trimmed] : [primera];

  for (const q of queries) {
    if (q.length < 2) continue;
    const rows = await buscarCiudades(pais, q, signal);
    if (rows.some((r) => norm(r.label) === nTarget)) return true;
  }
  return false;
}
