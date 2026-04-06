import type { CiudadOpcion, PaisCodigo } from './types';
import { buscarArgentina } from './argentina';
import { buscarUruguay } from './uruguay';

/**
 * Registro de buscadores por país. Al sumar un país nuevo, importar su módulo y asignarlo aquí.
 */
const buscadores: Record<PaisCodigo, (q: string, signal?: AbortSignal) => Promise<CiudadOpcion[]>> = {
  AR: buscarArgentina,
  UY: buscarUruguay,
};

/**
 * Busca ciudades/localidades para el país indicado (mín. 2 caracteres en la UI).
 */
export async function buscarCiudades(
  pais: PaisCodigo,
  query: string,
  signal?: AbortSignal,
): Promise<CiudadOpcion[]> {
  const fn = buscadores[pais];
  if (!fn) return [];
  return fn(query, signal);
}
