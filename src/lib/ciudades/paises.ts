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
] as const;

export function esPaisSoportado(c: string): c is PaisCodigo {
  return c === 'AR' || c === 'UY';
}

/** Heurística para edición de viajes ya guardados (solo texto, sin campo país en BD). */
export function inferirPaisDesdeUbicacion(texto: string): PaisCodigo {
  const t = texto.trim().toLowerCase();
  if (t.endsWith(', uruguay') || t.includes(', uruguay') || /\buruguay\b/.test(t)) return 'UY';
  return 'AR';
}
