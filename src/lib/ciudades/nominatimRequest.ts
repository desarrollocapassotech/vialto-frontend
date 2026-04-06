/** Nominatim con URL absoluta: CORS `*`; el proxy de Vite no aplica en `vite preview` y puede devolver HTML del SPA. */
export function nominatimSearchUrl(params: Record<string, string>): string {
  const q = new URLSearchParams(params).toString();
  return `https://nominatim.openstreetmap.org/search?${q}`;
}
