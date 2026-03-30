import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { labelVehiculoTipo } from '@/lib/labels';
import type { Vehiculo } from '@/types/api';

export function VehiculosTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Vehiculo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Vehiculo[]>('/api/vehiculos', () =>
          getToken(),
        );
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, 'vehiculos'));
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
        Vehículos
      </h1>
      <p className="mt-2 text-vialto-steel">
        Patentes, tipo y marca de cada unidad de tu flota.
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
        {rows?.map((v) => (
          <li
            key={v.id}
            className="rounded border border-black/5 bg-white px-4 py-3 flex justify-between gap-4 flex-wrap"
          >
            <span className="font-[family-name:var(--font-ui)] tracking-wider font-semibold">
              {v.patente}
            </span>
            <span className="text-vialto-steel text-sm capitalize">
              {labelVehiculoTipo(v.tipo)}
              {v.marca ? ` · ${v.marca}` : ''}
            </span>
          </li>
        ))}
        {rows?.length === 0 && (
          <li className="text-vialto-steel">
            Todavía no tenés vehículos cargados.
          </li>
        )}
      </ul>
    </div>
  );
}
