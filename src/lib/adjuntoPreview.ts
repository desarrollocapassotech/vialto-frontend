export type AdjuntoPreviewTipo = 'pdf' | 'imagen' | 'desconocido';

/** Visor PDF embebido: sin panel lateral, barra con zoom, página completa al abrir. */
export function pdfEmbedSrc(objectUrl: string): string {
  return `${objectUrl}#navpanes=0&toolbar=1&page=1&zoom=page-fit`;
}

export function detectarTipoAdjuntoDesdeContentType(contentType: string): AdjuntoPreviewTipo {
  const ct = contentType.toLowerCase();
  if (ct.includes('pdf')) return 'pdf';
  if (ct.startsWith('image/')) return 'imagen';
  return 'desconocido';
}

export function contentTypeFromFile(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (/\.jpe?g$/.test(name)) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (/\.heic$/.test(name)) return 'image/heic';
  if (/\.heif$/.test(name)) return 'image/heif';
  return 'application/octet-stream';
}

export function detectarTipoAdjunto(url: string): AdjuntoPreviewTipo {
  const base = url.toLowerCase().split('?')[0]?.split('#')[0] ?? '';
  if (base.endsWith('.pdf') || base.includes('/raw/upload/')) return 'pdf';
  if (/\.(jpe?g|png|gif|webp|bmp|svg|avif|heic|heif)$/.test(base) || base.includes('/image/upload/')) {
    return 'imagen';
  }
  return 'desconocido';
}
