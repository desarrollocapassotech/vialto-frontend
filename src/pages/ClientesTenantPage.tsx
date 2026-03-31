import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Cliente } from '@/types/api';

export function ClientesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Cliente[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Cliente[]>('/api/clientes', () =>
          getToken(),
        );
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, 'clientes'));
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
        Clientes
      </h1>
      <p className="mt-2 text-vialto-steel">
        Las empresas o personas a las que les prestás el servicio.
      </p>
      <div className="mt-4 flex justify-end">
        <Link
          to="/clientes/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Crear cliente
        </Link>
      </div>
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
            className="rounded border border-black/5 bg-white px-4 py-3 flex justify-between gap-4 items-center"
          >
            <div>
              <span className="font-medium">{c.nombre}</span>
              <span className="ml-3 text-vialto-steel text-sm">{c.cuit ?? '—'}</span>
            </div>
            <Link
              to={`/clientes/${encodeURIComponent(c.id)}/editar`}
              className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
            >
              Editar
            </Link>
          </li>
        ))}
        {rows?.length === 0 && (
          <li className="text-vialto-steel">
            Todavía no tenés clientes cargados.
          </li>
        )}
      </ul>
    </div>
  );
}
