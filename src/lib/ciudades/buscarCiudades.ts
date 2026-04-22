import type { CiudadOpcion, PaisCodigo } from './types';
import { buscarArgentina } from './argentina';
import { buscarUruguay } from './uruguay';
import { buscarParaguay } from './paraguay';
import { buscarChile } from './chile';
import { buscarBrasil } from './brasil';

/**
 * Registro de buscadores por país. Al sumar un país nuevo, importar su módulo y asignarlo aquí.
 */
const buscadores: Record<PaisCodigo, (q: string, signal?: AbortSignal) => Promise<CiudadOpcion[]>> = {
  AR: buscarArgentina,
  UY: buscarUruguay,
  PY: buscarParaguay,
  CL: buscarChile,
  BR: buscarBrasil,
};

/**
 * Busca ciudades/localidades para el país indicado (mín. 2 caracteres en la UI).
 * La consulta se normaliza a minúsculas para que Georef/Nominatim no dependan del uso de mayúsculas.
 */
export async function buscarCiudades(
  pais: PaisCodigo,
  query: string,
  signal?: AbortSignal,
): Promise<CiudadOpcion[]> {
  const fn = buscadores[pais];
  if (!fn) return [];
  const t = query.trim();
  if (t.length < 2) return [];
  const q = t.toLowerCase();
  return fn(q, signal);
}
