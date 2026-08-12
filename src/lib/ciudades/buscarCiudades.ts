import type { CiudadOpcion, PaisCodigo } from './types';
import { buscarArgentina } from './argentina';
import { buscarUruguay } from './uruguay';
import { buscarParaguay } from './paraguay';
import { buscarChile } from './chile';
import { buscarBrasil } from './brasil';
import { buscarPaisDefault } from './paisDefault';

/**
 * Registro de buscadores dedicados por país. Al sumar un país con lógica propia,
 * importar su módulo y asignarlo aquí. Los países sin entrada acá usan el
 * buscador genérico (Nominatim filtrado por código de país) como respaldo.
 */
const buscadores: Partial<Record<string, (q: string, signal?: AbortSignal) => Promise<CiudadOpcion[]>>> = {
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
  const t = query.trim();
  if (t.length < 2) return [];
  const q = t.toLowerCase();

  const fn = buscadores[pais];
  if (fn) return fn(q, signal);

  // País sin buscador dedicado (creado al vuelo): fallback genérico vía Nominatim.
  return buscarPaisDefault(pais, q, signal);
}
