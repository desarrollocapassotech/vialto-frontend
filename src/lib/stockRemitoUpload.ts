import { apiJson } from '@/lib/api';

export async function uploadStockIngresoFoto(
  getToken: () => Promise<string | null>,
  file: File,
  tenantId?: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const path = tenantId
    ? `/api/platform/stock/upload-foto-ingreso?tenantId=${encodeURIComponent(tenantId)}`
    : '/api/stock/upload-foto-ingreso';
  const res = await apiJson<{ url: string }>(path, getToken, { method: 'POST', body: form });
  return res.url;
}

/** @deprecated Usar uploadStockIngresoFoto */
export async function uploadStockRemitoPdf(
  getToken: () => Promise<string | null>,
  file: File,
  tenantId?: string,
): Promise<string> {
  return uploadStockIngresoFoto(getToken, file, tenantId);
}

export function isIngresoFotoFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}
