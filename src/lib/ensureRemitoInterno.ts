import { apiFetch } from '@/lib/api';

export type RemitoInternoPdfResponse = {
  url: string;
  generated: boolean;
};

export function remitoInternoViewPath(egresoId: string, tenantId?: string): string {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const base = tenantId ? '/api/platform/stock/egresos' : '/api/stock/egresos';
  return `${base}/${encodeURIComponent(egresoId)}/remito-interno/view${qs}`;
}

export function remitoInternoApiUrl(egresoId: string, tenantId?: string): string {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const base = tenantId ? '/api/platform/stock/egresos' : '/api/stock/egresos';
  return `${base}/${encodeURIComponent(egresoId)}/remito-interno${qs}`;
}

/** Carga el PDF vía backend (inline) y devuelve una URL local para el visor. */
export async function fetchRemitoInternoPdfBlob(
  egresoId: string,
  getToken: () => Promise<string | null>,
  tenantId?: string,
): Promise<{ objectUrl: string; contentType: string }> {
  const res = await apiFetch(remitoInternoViewPath(egresoId, tenantId), getToken);
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
  return { objectUrl: URL.createObjectURL(blob), contentType };
}

export async function ensureRemitoInternoPdf(
  egresoId: string,
  getToken: () => Promise<string | null>,
  tenantId?: string,
): Promise<RemitoInternoPdfResponse> {
  const res = await apiFetch(remitoInternoApiUrl(egresoId, tenantId), getToken, { method: 'POST' });
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
  return res.json() as Promise<RemitoInternoPdfResponse>;
}
