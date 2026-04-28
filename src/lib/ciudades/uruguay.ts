import type { CiudadOpcion } from './types';
import { nominatimSearchUrl, nominatimFetch } from './nominatimRequest';
import { sugerenciasUruguayCoincidentes } from './uruguaySugerencias';

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
  place_rank?: number;
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

function urlBusquedaEstructuradaUY(ciudad: string): string {
  return `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: '12',
    countrycodes: 'uy',
    city: ciudad.trim(),
    country: 'Uruguay',
  })}`;
}

function prioridadNominatim(item: NominatimItem): number {
  if (item.class === 'boundary' && item.type === 'administrative') {
    return 1_000_000 + (item.importance ?? 0) * 1_000_000;
  }
  if (item.class === 'place') {
    return 500_000 + (item.importance ?? 0) * 1_000_000;
  }
  return item.importance ?? 0;
}

function etiquetaUruguay(item: NominatimItem): string | null {
  if (item.addresstype && IGNORAR_ADDRESSTYPE.has(item.addresstype)) return null;
  if (item.class === 'shop' || item.class === 'amenity') return null;

  const addr = item.address;
  if (!addr || addr.country_code !== 'uy') return null;
  const locality =
    addr.city?.trim() ||
    addr.town?.trim() ||
    addr.village?.trim() ||
    addr.municipality?.trim();
  const dept = (addr.state || addr.county)?.trim();
  if (locality && dept && locality.toLowerCase() !== dept.toLowerCase()) {
    return `${locality}, ${dept}, Uruguay`;
  }
  if (locality) return `${locality}, Uruguay`;
  if (dept) return `${dept}, Uruguay`;
  return null;
}

function normalizarLabel(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export async function buscarUruguay(query: string, signal?: AbortSignal): Promise<CiudadOpcion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const desdeLista = sugerenciasUruguayCoincidentes(q);

  const urlLibre = nominatimSearchUrl({
    format: 'json',
    addressdetails: '1',
    limit: '35',
    countrycodes: 'uy',
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
    const estructurada = await nominatimFetch<NominatimItem[]>(
      urlBusquedaEstructuradaUY(q),
      signal,
    );
    if (Array.isArray(estructurada)) {
      for (const item of estructurada) {
        if (!porId.has(item.place_id)) porId.set(item.place_id, item);
      }
    }
  }

  const ordenados = [...porId.values()].sort((a, b) => prioridadNominatim(b) - prioridadNominatim(a));

  const seen = new Set<string>();
  const out: CiudadOpcion[] = [];

  for (const s of desdeLista) {
    const k = normalizarLabel(s.label);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }

  for (const item of ordenados) {
    const label = etiquetaUruguay(item);
    if (!label) continue;
    const k = normalizarLabel(label);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id: `uy-${item.place_id}`, label });
  }

  return out;
}
