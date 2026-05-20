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

/**
 * Valida el formato del identificador fiscal según el país.
 * Retorna un mensaje de error o null si el valor es válido (o vacío).
 */
export function validarIdFiscal(pais: PaisCodigo | '', valor: string): string | null {
  if (!valor) return null;

  switch (pais) {
    case 'AR': {
      // Solo dígitos y guiones: XX-XXXXXXXX-X o XXXXXXXXXXX
      if (!/^[\d-]+$/.test(valor))
        return 'El CUIT/CUIL solo puede contener dígitos y guiones.';
      const d = valor.replace(/-/g, '');
      if (d.length !== 11)
        return `El CUIT/CUIL debe tener 11 dígitos (se ingresaron ${d.length}).`;
      break;
    }
    case 'UY': {
      // Solo dígitos y espacios: XX XXXXXX XXXX
      if (!/^[\d\s]+$/.test(valor))
        return 'El RUT solo puede contener dígitos y espacios.';
      const d = valor.replace(/\s/g, '');
      if (d.length !== 12)
        return `El RUT debe tener 12 dígitos (se ingresaron ${d.length}).`;
      break;
    }
    case 'PY': {
      // Solo dígitos y guiones: XXXXXXXX-X
      if (!/^[\d-]+$/.test(valor))
        return 'El RUC solo puede contener dígitos y guiones.';
      const d = valor.replace(/-/g, '');
      if (d.length < 5 || d.length > 10)
        return `El RUC debe tener entre 5 y 10 dígitos (se ingresaron ${d.length}).`;
      break;
    }
    case 'CL': {
      // Dígitos, puntos y guión: 12.345.678-9 o 12345678-9
      const rut = valor.replace(/[.\s]/g, '').toUpperCase();
      if (!/^\d{7,8}-[\dK]$/.test(rut))
        return 'El RUT debe tener el formato 12.345.678-9 (7 u 8 dígitos más dígito verificador).';
      break;
    }
    case 'BR': {
      // Solo dígitos y separadores estándar: . / -
      if (!/^[\d./-]+$/.test(valor))
        return 'El CNPJ/CPF solo puede contener dígitos y separadores (., /, -).';
      const d = valor.replace(/\D/g, '');
      if (d.length !== 11 && d.length !== 14)
        return `El CNPJ/CPF debe tener 11 dígitos (CPF) o 14 dígitos (CNPJ) (se ingresaron ${d.length}).`;
      break;
    }
    default:
      break;
  }
  return null;
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
