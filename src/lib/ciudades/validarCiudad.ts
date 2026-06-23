import { buscarCiudades } from './buscarCiudades';
import { inferirPaisDesdeUbicacion } from './paises';
import type { PaisCodigo } from './types';

export type ResultadoResolverCiudad =
  | { ok: true; canonica: string }
  | { ok: false; advertencia: string };

/** Comparación insensible a mayúsculas y tildes (misma ciudad con distinto formato). */
export function normalizarEtiquetaCiudad(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * Comprueba que el texto coincida con alguna opción devuelta por el buscador del país
 * (misma etiqueta que al elegir de la lista).
 */
async function buscarCoincidenciaCatalogo(
  pais: PaisCodigo,
  trimmed: string,
  signal?: AbortSignal,
): Promise<ResultadoResolverCiudad | null> {
  if (trimmed.length < 2) return null;

  const nTarget = normalizarEtiquetaCiudad(trimmed);
  const primera = trimmed.split(',')[0]?.trim() ?? trimmed;
  const queries =
    primera.length >= 2 && primera !== trimmed ? [primera, trimmed] : [primera];

  for (const q of queries) {
    if (q.length < 2) continue;
    const rows = await buscarCiudades(pais, q, signal);
    const exact = rows.find((r) => normalizarEtiquetaCiudad(r.label) === nTarget);
    if (exact) return { ok: true, canonica: exact.label };
  }

  if (!trimmed.includes(',')) {
    for (const q of queries) {
      if (q.length < 2) continue;
      const rows = await buscarCiudades(pais, q, signal);
      const nCity = normalizarEtiquetaCiudad(primera);
      const byCity = rows.filter((r) => {
        const cityPart = r.label.split(',')[0]?.trim() ?? r.label;
        return normalizarEtiquetaCiudad(cityPart) === nCity;
      });
      if (byCity.length === 1) return { ok: true, canonica: byCity[0].label };
      if (byCity.length > 1) {
        return {
          ok: false,
          advertencia: `"${trimmed}" coincide con varias ciudades del catálogo. Especificá provincia o departamento.`,
        };
      }
    }
  }

  return {
    ok: false,
    advertencia: `"${trimmed}" no coincide con ninguna ciudad del catálogo.`,
  };
}

/**
 * Resuelve un texto de origen/destino contra el catálogo (misma lógica que CiudadCombobox).
 * Devuelve la etiqueta canónica si hay match; si no, advertencia sin bloquear.
 */
export async function resolverEtiquetaCiudadCatalogo(
  label: string | null | undefined,
  signal?: AbortSignal,
): Promise<{ original: string | null; canonica: string | null; advertencia: string | null }> {
  if (label == null || !label.trim()) {
    return { original: null, canonica: null, advertencia: null };
  }

  const trimmed = label.trim();
  const pais = inferirPaisDesdeUbicacion(trimmed);
  const result = await buscarCoincidenciaCatalogo(pais, trimmed, signal);

  if (!result) {
    return { original: trimmed, canonica: trimmed, advertencia: null };
  }
  if (result.ok) {
    return { original: trimmed, canonica: result.canonica, advertencia: null };
  }
  return { original: trimmed, canonica: trimmed, advertencia: result.advertencia };
}

export async function esEtiquetaCiudadValida(
  pais: PaisCodigo,
  label: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const trimmed = label.trim();
  if (trimmed.length < 2) return false;

  const result = await buscarCoincidenciaCatalogo(pais, trimmed, signal);
  return result?.ok === true;
}
