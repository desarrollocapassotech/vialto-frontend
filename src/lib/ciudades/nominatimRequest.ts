const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const MIN_MS = 1100;
const CACHE_TTL = 5 * 60 * 1000;

const _cache = new Map<string, { data: unknown; ts: number }>();
let _lastAt = 0;
let _queue: Promise<void> = Promise.resolve();

export function nominatimSearchUrl(params: Record<string, string>): string {
  return `${NOMINATIM_BASE}/search?${new URLSearchParams(params)}`;
}

/**
 * Fetch serializado + cacheado para Nominatim.
 * - Máximo 1 request cada 1.1 s (cola global).
 * - Resultados cacheados 5 min: misma URL → respuesta inmediata sin red.
 * - Respeta AbortSignal: cancela si el componente se desmonta.
 */
export function nominatimFetch<T = unknown>(url: string, signal?: AbortSignal): Promise<T> {
  const hit = _cache.get(url);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return Promise.resolve(hit.data as T);
  }

  return new Promise<T>((resolve, reject) => {
    _queue = _queue
      .then(async () => {
        const h2 = _cache.get(url);
        if (h2 && Date.now() - h2.ts < CACHE_TTL) {
          resolve(h2.data as T);
          return;
        }
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        const wait = MIN_MS - (Date.now() - _lastAt);
        if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        _lastAt = Date.now();
        try {
          const res = await fetch(url, { signal, credentials: 'omit' });
          if (!res.ok) {
            reject(new Error(`Nominatim ${res.status}`));
            return;
          }
          const data = (await res.json()) as T;
          _cache.set(url, { data, ts: Date.now() });
          resolve(data);
        } catch (err) {
          reject(err);
        }
      })
      .catch(() => {
        // La cola nunca se rompe por errores individuales
      });
  });
}
