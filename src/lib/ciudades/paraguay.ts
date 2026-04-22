import type { CiudadOpcion } from './types';
import { nominatimSearchUrl } from './nominatimRequest';

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
    country_code?: string;
  };
};

function etiquetaParaguay(item: NominatimItem): string | null {
  if (item.addresstype && IGNORAR_ADDRESSTYPE.has(item.addresstype)) return null;
  if (item.class === 'shop' || item.class === 'amenity') return null;

  const addr = item.address;
  if (!addr || addr.country_code !== 'py') return null;
  const locality =
    addr.city?.trim() ||
    addr.town?.trim() ||
    addr.village?.trim() ||
    addr.municipality?.trim();
  const depto = (addr.state || addr.county)?.trim();
  if (locality && depto && locality.toLowerCase() !== depto.toLowerCase()) {
    return `${locality}, ${depto}, Paraguay`;
  }
  if (locality) return `${locality}, Paraguay`;
  if (depto) return `${depto}, Paraguay`;
  return null;
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

export async function buscarParaguay(query: string, signal?: AbortSignal): Promise<CiudadOpcion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const urlLibre = nominatimSearchUrl({
    format: 'json',
    addressdetails: '1',
    limit: '35',
    countrycodes: 'py',
    q,
  });

  const promesas: Promise<Response>[] = [fetch(urlLibre, { signal, credentials: 'omit' })];
  if (q.length >= 3) {
    const urlEstructurada = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
      format: 'json',
      addressdetails: '1',
      limit: '12',
      countrycodes: 'py',
      city: q,
      country: 'Paraguay',
    })}`;
    promesas.push(fetch(urlEstructurada, { signal, credentials: 'omit' }));
  }

  const respuestas = await Promise.all(promesas);
  for (const res of respuestas) {
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  }

  const porId = new Map<number, NominatimItem>();
  for (const res of respuestas) {
    const data = (await res.json()) as NominatimItem[];
    if (!Array.isArray(data)) continue;
    for (const item of data) {
      if (!porId.has(item.place_id)) porId.set(item.place_id, item);
    }
  }

  const ordenados = [...porId.values()].sort((a, b) => prioridad(b) - prioridad(a));

  const seen = new Set<string>();
  const out: CiudadOpcion[] = [];
  for (const item of ordenados) {
    const label = etiquetaParaguay(item);
    if (!label) continue;
    const k = normalizar(label);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id: `py-${item.place_id}`, label });
  }
  return out;
}
