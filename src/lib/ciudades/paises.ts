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

type IdFiscalInfo = { label: string; placeholder: string };

const ID_FISCAL_POR_PAIS: Record<PaisCodigo, IdFiscalInfo> = {
  AR: { label: 'CUIT / CUIL', placeholder: '30-71234567-8' },
  UY: { label: 'RUT',         placeholder: '21 234567 0001' },
  PY: { label: 'RUC',         placeholder: '80001234-5' },
  CL: { label: 'RUT',         placeholder: '12.345.678-9' },
  BR: { label: 'CNPJ / CPF',  placeholder: '12.345.678/0001-90' },
};

const ID_FISCAL_DEFAULT: IdFiscalInfo = { label: 'ID Fiscal', placeholder: 'CUIT / RUT / RUC / NIF' };

export function idFiscalPorPais(pais: PaisCodigo | ''): IdFiscalInfo {
  return pais ? ID_FISCAL_POR_PAIS[pais] : ID_FISCAL_DEFAULT;
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
