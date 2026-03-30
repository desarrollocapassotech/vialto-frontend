import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Chofer } from '@/types/api';

export function ChoferesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Chofer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Chofer[]>('/api/choferes', () =>
          getToken(),
        );
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, 'choferes'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <div className="max-w-5xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Choferes
      </h1>
      <p className="mt-2 text-vialto-steel">
        Quienes manejan tus unidades, con datos de contacto a mano.
      </p>
      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      <ul className="mt-8 space-y-2">
        {rows === null && !error && (
          <li className="text-vialto-steel">Cargando…</li>
        )}
        {rows?.map((c) => (
          <li
            key={c.id}
            className="rounded border border-black/5 bg-white px-4 py-3 flex justify-between gap-4 flex-wrap"
          >
            <span className="font-medium">{c.nombre}</span>
            <span className="text-vialto-steel text-sm">
              {c.telefono ?? c.dni ?? '—'}
            </span>
          </li>
        ))}
        {rows?.length === 0 && (
          <li className="text-vialto-steel">
            Todavía no tenés choferes cargados.
          </li>
        )}
      </ul>
    </div>
  );
}
