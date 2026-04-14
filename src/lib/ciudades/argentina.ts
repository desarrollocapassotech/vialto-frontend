import type { CiudadOpcion } from './types';
import { nominatimSearchUrl } from './nominatimRequest';

const GEOREF_PATH = '/api/localidades';

/** Siempre HTTPS: Georef expone CORS `*`; rutas relativas dependen del proxy de Vite y en preview devuelven el index.html del SPA. */
function georefBaseUrl(): string {
  return `https://apis.datos.gob.ar/georef${GEOREF_PATH}`;
}

type GeorefLocalidadesResponse = {
  localidades?: {
    id: string;
    nombre: string;
    provincia?: { nombre: string | null } | null;
  }[];
};

async function buscarGeoref(query: string, signal?: AbortSignal): Promise<CiudadOpcion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = `${georefBaseUrl()}?${new URLSearchParams({
    nombre: q,
    max: '50',
    campos: 'id,nombre,provincia.nombre',
  })}`;

  const res = await fetch(url, { signal, credentials: 'omit' });
  if (!res.ok) throw new Error(`Georef ${res.status}`);

  const data = (await res.json()) as GeorefLocalidadesResponse;
  const list = data.localidades ?? [];
  const seen = new Set<string>();
  const out: CiudadOpcion[] = [];
  for (const loc of list) {
    const prov = loc.provincia?.nombre?.trim();
    if (!prov) continue;
    const label = `${loc.nombre.trim()}, ${prov}`;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ id: loc.id, label });
  }
  return out;
}

type NominatimItem = {
  place_id: number;
  class?: string;
  addresstype?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country_code?: string;
  };
};

/** POIs que no son localidades (evita coincidencias tipo “Ro” peluquería). */
const IGNORAR_ADDRESSTYPE = new Set([
  'shop',
  'house',
  'building',
  'road',
  'suburb',
  'neighbourhood',
  'quarter',
  'farm',
  'industrial',
]);

function etiquetaArgentinaDesdeNominatim(item: NominatimItem): string | null {
  const addr = item.address;
  if (!addr || addr.country_code !== 'ar') return null;
  const state = addr.state?.trim();
  if (!state) return null;
  const locality =
    addr.city?.trim() || addr.town?.trim() || addr.village?.trim() || addr.municipality?.trim();
  if (!locality) return null;

  if (item.addresstype && IGNORAR_ADDRESSTYPE.has(item.addresstype)) return null;
  if (item.class === 'shop' || item.class === 'amenity' || item.class === 'tourism') return null;

  return `${locality}, ${state}`;
}

/**
 * Respaldo: Nominatim devuelve resultados con búsquedas cortas (“ros” → Rosario) donde Georef devuelve vacío.
 */
async function buscarNominatimAr(query: string, signal?: AbortSignal): Promise<CiudadOpcion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = nominatimSearchUrl({
    format: 'json',
    addressdetails: '1',
    limit: '25',
    countrycodes: 'ar',
    q,
  });

  const res = await fetch(url, { signal, credentials: 'omit' });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);

  const data = (await res.json()) as NominatimItem[];
  if (!Array.isArray(data)) return [];

  const seen = new Set<string>();
  const out: CiudadOpcion[] = [];
  for (const item of data) {
    const label = etiquetaArgentinaDesdeNominatim(item);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({ id: `ar-nm-${item.place_id}`, label });
  }
  return out;
}

function normalizarLabelClave(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Georef (oficial) + Nominatim (OpenStreetMap), sin duplicar por etiqueta.
 * Antes solo se usaba Nominatim si Georef devolvía vacío; eso ocultaba muchas coincidencias útiles.
 */
export async function buscarArgentina(query: string, signal?: AbortSignal): Promise<CiudadOpcion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [geoRes, nomRes] = await Promise.allSettled([
    buscarGeoref(q, signal),
    buscarNominatimAr(q, signal),
  ]);

  const geo = geoRes.status === 'fulfilled' ? geoRes.value : [];
  const nom = nomRes.status === 'fulfilled' ? nomRes.value : [];

  const seen = new Set<string>();
  const out: CiudadOpcion[] = [];

  for (const c of geo) {
    const k = normalizarLabelClave(c.label);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  for (const c of nom) {
    const k = normalizarLabelClave(c.label);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }

  return out;
}
