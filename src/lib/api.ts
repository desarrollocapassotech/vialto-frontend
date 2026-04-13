/**
 * Origen del API (sin `/api` final; las rutas ya llevan `/api/...`).
 *
 * En desarrollo, por defecto se usa **origen relativo** (`''`) para que el fetch vaya al
 * mismo host que Vite (p. ej. `localhost:5173`) y el proxy de Vite reenvíe a Nest.
 * Así el `Authorization: Bearer` no depende de CORS entre puertos (evita 401 "Token requerido").
 *
 * Para hablar directo con otro host (túnel, otro puerto), definí `VITE_API_URL`.
 */
function baseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  if (configured) return configured;
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
