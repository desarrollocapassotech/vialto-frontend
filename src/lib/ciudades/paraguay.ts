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

  const porId = new Map<number, NominatimItem>();

  const libre = await nominatimFetch<NominatimItem[]>(urlLibre, signal);
  if (Array.isArray(libre)) {
    for (const item of libre) {
      if (!porId.has(item.place_id)) porId.set(item.place_id, item);
    }
  }

  if (q.length >= 3) {
    const urlEstructurada = nominatimSearchUrl({
      format: 'json',
      addressdetails: '1',
      limit: '12',
      countrycodes: 'py',
      city: q,
      country: 'Paraguay',
    });
    const estructurada = await nominatimFetch<NominatimItem[]>(urlEstructurada, signal);
    if (Array.isArray(estructurada)) {
      for (const item of estructurada) {
        if (!porId.has(item.place_id)) porId.set(item.place_id, item);
      }
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
