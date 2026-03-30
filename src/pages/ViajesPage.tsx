import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Viaje } from '@/types/api';

const estadoLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_transito: 'En tránsito',
  despachado: 'Despachado',
  cerrado: 'Cerrado',
};

export function ViajesPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Viaje[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Viaje[]>('/api/viajes', () => getToken());
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, 'viajes'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  return (
    <div className="max-w-6xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Viajes
      </h1>
      <p className="mt-2 text-vialto-steel">
        Número, estado, origen, destino y margen de cada operación.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="mt-8 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Destino</th>
              <th className="px-4 py-3 text-right">Margen</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                  Todavía no hay viajes cargados.
                </td>
              </tr>
            )}
            {rows?.map((v) => (
              <tr
                key={v.id}
                className="border-b border-black/5 hover:bg-vialto-mist/80"
              >
                <td className="px-4 py-3 font-medium">{v.numero}</td>
                <td className="px-4 py-3">
                  <span className="inline-block font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 bg-vialto-charcoal text-white">
                    {estadoLabel[v.estado] ?? 'Sin clasificar'}
                  </span>
                </td>
                <td className="px-4 py-3 text-vialto-steel max-w-[180px] truncate">
                  {v.origen ?? '—'}
                </td>
                <td className="px-4 py-3 text-vialto-steel max-w-[180px] truncate">
                  {v.destino ?? '—'}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {v.gananciaBruta != null
                    ? `$ ${v.gananciaBruta.toLocaleString('es-AR')}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
