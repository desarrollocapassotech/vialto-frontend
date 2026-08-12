import type { CiudadOpcion } from './types';
import { nominatimSearchUrl, nominatimFetch } from './nominatimRequest';

const IGNORAR_ADDRESSTYPE = new Set([
  'shop',
  'house',
  'road',
  'suburb',
  'neighbourhood',
  'quarter',
]);

type NominatimItem = {
  place_id: number;
  class?: string;
  type?: string;
  importance?: number;
  addresstype?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    county?: string;
    country?: string;
    country_code?: string;
  };
};

function etiquetaGenerica(item: NominatimItem, paisCodigoLower: string): string | null {
  if (item.addresstype && IGNORAR_ADDRESSTYPE.has(item.addresstype)) return null;
  if (item.class === 'shop' || item.class === 'amenity') return null;

  const addr = item.address;
  if (!addr || addr.country_code !== paisCodigoLower) return null;

  const locality =
    addr.city?.trim() ||
    addr.town?.trim() ||
    addr.village?.trim() ||
    addr.municipality?.trim();
  const region = (addr.state || addr.county)?.trim();
  const pais = addr.country?.trim();

  if (!locality && !region) return null;

  const partes = [locality, region].filter(
    (p, i, arr) => p && arr.indexOf(p) === i, // evita repetir si locality === region
  );
  if (pais) partes.push(pais);
  return partes.join(', ') || null;
}

function prioridad(item: NominatimItem): number {
  if (item.class === 'boundary' && item.type === 'administrative') {
    return 1_000_000 + (item.importance ?? 0) * 1_000_000;
  }
  if (item.class === 'place') {
    return 500_000 + (item.importance ?? 0) * 1_000_000;
  }
  return item.importance ?? 0;
}

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/**
 * Buscador de respaldo para países sin función dedicada (todo lo que no sea AR/UY/PY/CL/BR).
 * Usa Nominatim (OpenStreetMap) filtrando por el código de país recibido.
 */
export async function buscarPaisDefault(
  paisCodigo: string,
  query: string,
  signal?: AbortSignal,
): Promise<CiudadOpcion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const paisCodigoLower = paisCodigo.trim().toLowerCase();
  if (!paisCodigoLower) return [];

  const url = nominatimSearchUrl({
    format: 'json',
    addressdetails: '1',
    limit: '35',
    countrycodes: paisCodigoLower,
    q,
  });

  const data = await nominatimFetch<NominatimItem[]>(url, signal);
  if (!Array.isArray(data)) return [];

  const ordenados = [...data].sort((a, b) => prioridad(b) - prioridad(a));

  const seen = new Set<string>();
  const out: CiudadOpcion[] = [];
  for (const item of ordenados) {
    const label = etiquetaGenerica(item, paisCodigoLower);
    if (!label) continue;
    const k = normalizar(label);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id: `${paisCodigoLower}-${item.place_id}`, label });
  }
  return out;
}