/**
 * Construye un query string a partir de un objeto de parámetros y, opcionalmente, un tenantId.
 * - Ignora valores vacíos o undefined (no ensucia la URL con `clienteId=`).
 * - Escapa los valores con encodeURIComponent.
 * - Devuelve '' si no hay ningún parámetro activo (en vez de un '?' colgando).
 */
export function buildQs(params: Record<string, string | undefined>, tenantId?: string): string {
  const parts: string[] = [];

  if (tenantId) {
    parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  }

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      parts.push(`${key}=${encodeURIComponent(value)}`);
    }
  }

  return parts.length ? `?${parts.join('&')}` : '';
}