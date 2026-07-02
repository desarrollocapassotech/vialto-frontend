export const STOCK_DOCUMENTO_EXTERNO_NO_TIENE = 'No tiene';

export type StockDocumentoExternoModo = 'numero' | 'no_tiene';

export function validarStockDocumentoExterno(
  modo: StockDocumentoExternoModo | '',
  numero: string,
): string | null {
  if (!modo) return 'Indicá el número de documento externo o elegí «No tiene».';
  if (modo === 'numero' && !numero.trim()) return 'Ingresá el número de documento externo.';
  return null;
}

export function stockDocumentoExternoParaApi(
  modo: StockDocumentoExternoModo | '',
  numero: string,
): string | null {
  if (modo === 'no_tiene') return STOCK_DOCUMENTO_EXTERNO_NO_TIENE;
  if (modo === 'numero') return numero.trim() || null;
  return null;
}

export function etiquetaStockDocumentoExterno(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : '—';
}
