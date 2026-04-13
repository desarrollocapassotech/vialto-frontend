/**
 * Máscara de moneda es-AR: separador de miles con punto, decimales con coma (máx. 2).
 */
export function maskCurrencyArInput(raw: string): string {
  let s = raw.replace(/\$/g, '').replace(/\s/g, '');
  if (!s) return '';

  // Pegado tipo 1234.56 (punto decimal) → 1234,56
  if (!s.includes(',') && /^\d+\.\d{1,2}$/.test(s)) {
    s = s.replace('.', ',');
  }

  const parts = s.split(',');
  const intRaw = parts[0] ?? '';
  let intDigits = intRaw.replace(/\D/g, '');
  const decDigits =
    parts.length > 1 ? parts.slice(1).join('').replace(/\D/g, '').slice(0, 2) : '';

  if (intDigits.length > 1) {
    intDigits = intDigits.replace(/^0+/, '') || '0';
  }

  const intFormatted = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (parts.length > 1 || s.includes(',')) {
    return `${intFormatted},${decDigits}`;
  }
  return intFormatted;
}

export function formatCurrencyArFromNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Convierte el valor mostrado en el input a número para enviar al API. */
export function parseCurrencyAr(value: string): number | undefined {
  const t = value.trim().replace(/\$/g, '').replace(/\s/g, '');
  if (!t) return undefined;
  const normalized = t.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/** Moneda de montos en viajes (API / DB). */
export type ViajeMonedaCodigo = 'ARS' | 'USD';

export function normalizeViajeMoneda(value: string | null | undefined): ViajeMonedaCodigo {
  return value === 'USD' ? 'USD' : 'ARS';
}

/**
 * Máscara en-US: miles con coma, decimales con punto (máx. 2).
 */
export function maskCurrencyUsdInput(raw: string): string {
  let s = raw.replace(/\$/g, '').replace(/\s/g, '');
  if (!s) return '';

  if (!s.includes('.') && /^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(',', '.');
  }

  const dotIdx = s.indexOf('.');
  const intPart = dotIdx === -1 ? s : s.slice(0, dotIdx);
  const decPart = dotIdx === -1 ? '' : s.slice(dotIdx + 1);

  let intDigits = intPart.replace(/,/g, '').replace(/\D/g, '');
  const decDigits = decPart.replace(/\D/g, '').slice(0, 2);

  if (intDigits.length > 1) {
    intDigits = intDigits.replace(/^0+/, '') || '0';
  }

  const intFormatted = intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (dotIdx !== -1) {
    return decDigits.length > 0 ? `${intFormatted}.${decDigits}` : `${intFormatted}.`;
  }
  return intFormatted;
}

export function formatUsdFromNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function parseCurrencyUsd(value: string): number | undefined {
  const t = value.trim().replace(/\$/g, '').replace(/\s/g, '');
  if (!t) return undefined;
  const normalized = t.replace(/,/g, '');
  const n = Number(normalized);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export function maskCurrencyForMoneda(raw: string, moneda: ViajeMonedaCodigo): string {
  return moneda === 'USD' ? maskCurrencyUsdInput(raw) : maskCurrencyArInput(raw);
}

export function parseCurrencyForMoneda(raw: string, moneda: ViajeMonedaCodigo): number | undefined {
  return moneda === 'USD' ? parseCurrencyUsd(raw) : parseCurrencyAr(raw);
}

export function formatNumberForMoneda(value: number | null | undefined, moneda: ViajeMonedaCodigo): string {
  return moneda === 'USD' ? formatUsdFromNumber(value) : formatCurrencyArFromNumber(value);
}
