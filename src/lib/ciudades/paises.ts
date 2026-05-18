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

// ── Condición tributaria ──────────────────────────────────────────────────────

export type CondicionSelectInfo = {
  type: 'select';
  label: string;
  options: readonly { value: number; label: string }[];
};
export type CondicionTextInfo = { type: 'text'; label: string; placeholder: string };
export type CondicionInfo = CondicionSelectInfo | CondicionTextInfo;

const CONDICION_IVA_AR: CondicionSelectInfo = {
  type: 'select',
  label: 'Condición frente al IVA',
  options: [
    { value: 1, label: 'IVA Responsable Inscripto' },
    { value: 6, label: 'Responsable Monotributo' },
    { value: 4, label: 'IVA Sujeto Exento' },
    { value: 5, label: 'Consumidor Final' },
  ],
};

const CONDICION_DEFAULT: CondicionTextInfo = {
  type: 'text',
  label: 'Condición tributaria',
  placeholder: 'Ej: Régimen General, Monotributo, etc.',
};

export function condicionTributariaPorPais(pais: PaisCodigo | ''): CondicionInfo {
  if (pais === 'AR') return CONDICION_IVA_AR;
  return CONDICION_DEFAULT;
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
