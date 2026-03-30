import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Viaje } from '@/types/api';

export function DashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [viajes, setViajes] = useState<Viaje[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Viaje[]>(
          '/api/viajes',
          () => getToken(),
        );
        if (!cancelled) {
          setViajes(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setViajes(null);
          setError(friendlyError(e, 'tablero'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  const total = viajes?.length ?? 0;
  const enTransito =
    viajes?.filter((v) => v.estado === 'en_transito').length ?? 0;

  return (
    <div className="max-w-5xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
        Tablero
      </h1>
      <p className="mt-2 text-vialto-steel max-w-xl">
        Un vistazo rápido a tus viajes: cuántos registraste y cuántos están en
        camino.
      </p>

      {error && (
        <div
          className="mt-6 rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-vialto-graphite p-6 flex flex-col justify-between min-h-[140px]">
          <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
            Viajes registrados
          </span>
          <div>
            <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
              {viajes === null && !error ? '—' : total}
            </span>
            <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-vialto-bright tracking-wide">
              Últimos movimientos
            </p>
          </div>
        </div>
        <div className="bg-vialto-graphite p-6 flex flex-col justify-between min-h-[140px]">
          <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
            En tránsito
          </span>
          <div>
            <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
              {viajes === null && !error ? '—' : enTransito}
            </span>
            <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-white/50 tracking-wide">
              En camino a destino
            </p>
          </div>
        </div>
        <div className="bg-vialto-graphite p-6 flex flex-col justify-between min-h-[140px] sm:col-span-2 lg:col-span-1">
          <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
            Acción rápida
          </span>
          <Link
            to="/viajes"
            className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.15em] text-vialto-bright hover:text-vialto-light mt-2"
          >
            Ver todos los viajes →
          </Link>
        </div>
      </div>
    </div>
  );
}
