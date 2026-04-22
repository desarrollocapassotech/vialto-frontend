import type { PaisCodigo } from './types';

export type PaisOpcion = {
  codigo: PaisCodigo;
  etiqueta: string;
};

/**
 * Lista de países disponibles en el buscador. Para agregar uno nuevo:
 * 1) ampliar `PaisCodigo` en types.ts
 * 2) añadir entrada aquí
 * 3) implementar `buscarXxx` y registrarlo en `buscarCiudades.ts`
 */
export const PAISES_SOPORTADOS: readonly PaisOpcion[] = [
  { codigo: 'AR', etiqueta: 'Argentina' },
  { codigo: 'UY', etiqueta: 'Uruguay' },
  { codigo: 'PY', etiqueta: 'Paraguay' },
  { codigo: 'CL', etiqueta: 'Chile' },
  { codigo: 'BR', etiqueta: 'Brasil' },
] as const;

export function esPaisSoportado(c: string): c is PaisCodigo {
  return c === 'AR' || c === 'UY' || c === 'PY' || c === 'CL' || c === 'BR';
}

/** Heurística para edición de viajes ya guardados (solo texto, sin campo país en BD). */
export function inferirPaisDesdeUbicacion(texto: string): PaisCodigo {
  const t = texto.trim().toLowerCase();
  if (t.endsWith(', uruguay') || t.includes(', uruguay') || /\buruguay\b/.test(t)) return 'UY';
  if (t.endsWith(', paraguay') || t.includes(', paraguay') || /\bparaguay\b/.test(t)) return 'PY';
  if (t.endsWith(', chile') || t.includes(', chile') || /\bchile\b/.test(t)) return 'CL';
  if (t.endsWith(', brasil') || t.includes(', brasil') || /\bbrasil\b/.test(t)) return 'BR';
  return 'AR';
}
