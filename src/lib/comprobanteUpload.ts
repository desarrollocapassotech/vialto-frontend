import { apiJson } from '@/lib/api';

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function isComprobanteFile(file: File): boolean {
  if (isPdfFile(file)) return true;
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

export async function uploadComprobante(
  getToken: () => Promise<string | null>,
  file: File,
  module: 'facturacion' | 'integracion-arca',
  tenantId?: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const base = tenantId
    ? `/api/platform/${module === 'facturacion' ? 'facturacion' : 'integracion-arca'}/upload-comprobante?tenantId=${encodeURIComponent(tenantId)}`
    : `/api/${module}/upload-comprobante`;
  const res = await apiJson<{ url: string }>(base, getToken, { method: 'POST', body: form });
  return res.url;
}
