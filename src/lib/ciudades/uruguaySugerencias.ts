import type { CiudadOpcion } from './types';

/**
 * Ciudades y localidades frecuentes (capital, capitales departamentales, área metro).
 * Cubre huecos de Nominatim cuando la consulta corta devuelve solo calles/POIs.
 */
const CIUDADES_UY: CiudadOpcion[] = [
  { id: 'uy-seed-montevideo', label: 'Montevideo, Uruguay' },
  { id: 'uy-seed-ciudad-de-la-costa', label: 'Ciudad de la Costa, Canelones, Uruguay' },
  { id: 'uy-seed-las-piedras', label: 'Las Piedras, Canelones, Uruguay' },
  { id: 'uy-seed-salto', label: 'Salto, Uruguay' },
  { id: 'uy-seed-paysandu', label: 'Paysandú, Paysandú, Uruguay' },
  { id: 'uy-seed-rivera', label: 'Rivera, Rivera, Uruguay' },
  { id: 'uy-seed-maldonado', label: 'Maldonado, Maldonado, Uruguay' },
  { id: 'uy-seed-tacuarembo', label: 'Tacuarembó, Tacuarembó, Uruguay' },
  { id: 'uy-seed-mercedes', label: 'Mercedes, Soriano, Uruguay' },
  { id: 'uy-seed-melo', label: 'Melo, Cerro Largo, Uruguay' },
  { id: 'uy-seed-artigas', label: 'Artigas, Artigas, Uruguay' },
  { id: 'uy-seed-minas', label: 'Minas, Lavalleja, Uruguay' },
  { id: 'uy-seed-durazno', label: 'Durazno, Durazno, Uruguay' },
  { id: 'uy-seed-barros-blancos', label: 'Barros Blancos, Canelones, Uruguay' },
  { id: 'uy-seed-san-jose', label: 'San José de Mayo, San José, Uruguay' },
  { id: 'uy-seed-colonia', label: 'Colonia del Sacramento, Colonia, Uruguay' },
  { id: 'uy-seed-pando', label: 'Pando, Canelones, Uruguay' },
  { id: 'uy-seed-canelones', label: 'Canelones, Canelones, Uruguay' },
  { id: 'uy-seed-rocha', label: 'Rocha, Rocha, Uruguay' },
  { id: 'uy-seed-fray-bentos', label: 'Fray Bentos, Río Negro, Uruguay' },
  { id: 'uy-seed-trinidad', label: 'Trinidad, Flores, Uruguay' },
  { id: 'uy-seed-treinta-y-tres', label: 'Treinta y Tres, Treinta y Tres, Uruguay' },
  { id: 'uy-seed-bella-union', label: 'Bella Unión, Artigas, Uruguay' },
  { id: 'uy-seed-carmelo', label: 'Carmelo, Colonia, Uruguay' },
  { id: 'uy-seed-nueva-helvecia', label: 'Nueva Helvecia, Colonia, Uruguay' },
  { id: 'uy-seed-nueva-palmira', label: 'Nueva Palmira, Colonia, Uruguay' },
  { id: 'uy-seed-salinas', label: 'Salinas, Canelones, Uruguay' },
  { id: 'uy-seed-atlantida', label: 'Atlántida, Canelones, Uruguay' },
  { id: 'uy-seed-la-paz', label: 'La Paz, Canelones, Uruguay' },
  { id: 'uy-seed-paso-de-los-toros', label: 'Paso de los Toros, Tacuarembó, Uruguay' },
  { id: 'uy-seed-rio-branco', label: 'Río Branco, Cerro Largo, Uruguay' },
  { id: 'uy-seed-young', label: 'Young, Río Negro, Uruguay' },
  { id: 'uy-seed-chuy', label: 'Chuy, Rocha, Uruguay' },
  { id: 'uy-seed-barra-de-valizas', label: 'Barra de Valizas, Rocha, Uruguay' },
];

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** Coincidencia por prefijo (sin acentos) sobre el nombre principal o cualquier palabra del label. */
export function sugerenciasUruguayCoincidentes(query: string): CiudadOpcion[] {
  const q = normalizar(query.trim());
  if (q.length < 2) return [];

  const out: CiudadOpcion[] = [];
  const seen = new Set<string>();

  for (const c of CIUDADES_UY) {
    const principal = c.label.split(',')[0].trim();
    const n = normalizar(principal);
    const palabras = n.split(/\s+/).filter(Boolean);
    const match = n.startsWith(q) || palabras.some((w) => w.startsWith(q));
    if (!match) continue;
    if (seen.has(c.label)) continue;
    seen.add(c.label);
    out.push(c);
  }

  return out;
}
