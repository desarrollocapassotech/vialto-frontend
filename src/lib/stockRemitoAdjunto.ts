import { apiFetch } from '@/lib/api';

export function remitoAdjuntoPath(movimientoId: string, tenantId?: string): string {
  if (tenantId?.trim()) {
    return `/api/platform/stock/movimientos/${encodeURIComponent(movimientoId)}/remito-adjunto?tenantId=${encodeURIComponent(tenantId.trim())}`;
  }
  return `/api/stock/movimientos/${encodeURIComponent(movimientoId)}/remito-adjunto`;
}

export async function fetchRemitoAdjuntoBlob(
  movimientoId: string,
  getToken: () => Promise<string | null>,
  tenantId?: string,
): Promise<{ blob: Blob; objectUrl: string; contentType: string }> {
  const res = await apiFetch(remitoAdjuntoPath(movimientoId, tenantId), getToken);
  if (!res.ok) {
    const text = await res.text();
    let message = res.statusText;
    try {
      const data = JSON.parse(text) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const contentType = res.headers.get('content-type') ?? blob.type ?? 'application/pdf';
  return { blob, objectUrl: URL.createObjectURL(blob), contentType };
}
