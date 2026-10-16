export type AdjuntoPreviewTipo = 'pdf' | 'imagen' | 'desconocido';

export function detectarTipoAdjunto(url: string): AdjuntoPreviewTipo {
  const base = url.toLowerCase().split('?')[0]?.split('#')[0] ?? '';
  if (base.endsWith('.pdf') || base.includes('/raw/upload/')) return 'pdf';
  if (/\.(jpe?g|png|gif|webp|bmp|svg|avif|heic|heif)$/.test(base) || base.includes('/image/upload/')) {
    return 'imagen';
  }
  return 'desconocido';
}
