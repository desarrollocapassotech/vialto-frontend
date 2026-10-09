/**
 * URL de `/api/mantenimiento/*`. `tenantId` solo se manda desde una vista embebida de
 * superadmin (el backend lo ignora para cualquier otro rol); en la vista del tenant va vacío.
 */
export function mantUrl(path: string, tenantId?: string, params?: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  if (tenantId) qs.set("tenantId", tenantId);
  const query = qs.toString();
  return `/api/mantenimiento/${path.replace(/^\//, "")}${query ? `?${query}` : ""}`;
}
