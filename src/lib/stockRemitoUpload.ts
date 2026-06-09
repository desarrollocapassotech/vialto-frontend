import { apiJson } from '@/lib/api';

export async function uploadStockRemitoPdf(
  getToken: () => Promise<string | null>,
  file: File,
  tenantId?: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const path = tenantId
    ? `/api/platform/stock/upload-remito?tenantId=${encodeURIComponent(tenantId)}`
    : '/api/stock/upload-remito';
  const res = await apiJson<{ url: string }>(path, getToken, { method: 'POST', body: form });
  return res.url;
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function isRemitoAdjuntoFile(file: File): boolean {
  if (isPdfFile(file)) return true;
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}
