/**
 * Origen del API (sin `/api` final; las rutas ya llevan `/api/...`).
 *
 * En desarrollo, por defecto se usa `http://localhost:8080` para hablar **directo**
 * con Nest (CORS ya permitido en el backend). Así se evitan 404 del proxy de Vite
 * con rutas como `/api/platform/viajes?tenantId=...` (superadmin).
 *
 * Podés forzar con `VITE_API_URL` (p. ej. otro puerto o túnel).
 */
function baseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (import.meta.env.DEV) {
    return 'http://localhost:8080';
  }
  return '';
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch(
  path: string,
  getToken: () => Promise<string | null>,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getToken();
  const url = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...init, headers, credentials: 'include', cache: 'no-store' });
}

export async function apiJson<T>(
  path: string,
  getToken: () => Promise<string | null>,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, getToken, init);
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText;
    throw new ApiError(msg || 'Respuesta no válida', res.status, data);
  }
  return data as T;
}
