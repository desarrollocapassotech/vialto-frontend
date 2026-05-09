import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';

function textoMontoPorMoneda(
  moneda: 'ARS' | 'USD',
  bloque: { ARS: number; USD: number } | undefined,
  tableroListo: boolean,
): string {
  if (!tableroListo || !bloque) return '—';
  const n = moneda === 'ARS' ? bloque.ARS : bloque.USD;
  if (n === 0) return '—';
  return moneda === 'ARS'
    ? `$ ${n.toLocaleString('es-AR')}`
    : `USD ${n.toLocaleString('es-AR')}`;
}

type TableroGeneralResponse = {
  deudores: Array<{
    clienteId: string;
    clienteNombre: string;
    saldo: number;
    deuda: number;
  }>;
  inconsistencias: {
    viajesFinalizadosSinCargo: Array<{ id: string; numero: string }>;
  };
  alertasOperativas: {
    viajesEnCursoHaceMasDeXHoras: Array<{ id: string; numero: string }>;
  };
  facturacion: {
    mesActual: { ARS: number; USD: number };
    mesAnterior: { ARS: number; USD: number };
  };
};

export function DashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [tablero, setTablero] = useState<TableroGeneralResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<TableroGeneralResponse>(
          '/api/reportes/tablero-general',
          () => getToken(),
        );
        if (!cancelled) {
          setTablero(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setTablero(null);
          setError(friendlyError(e, 'tablero'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  const totalDeudores = tablero?.deudores.length ?? 0;
  const totalInconsistencias = tablero?.inconsistencias.viajesFinalizadosSinCargo.length ?? 0;
  const totalViajesAtrasados = tablero?.alertasOperativas.viajesEnCursoHaceMasDeXHoras.length ?? 0;
  const factActual = tablero?.facturacion.mesActual;
  const factAnterior = tablero?.facturacion.mesAnterior;
  const tableroListo = tablero !== null;

  return (
    <div className="max-w-5xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
        Tablero
      </h1>
      <p className="mt-2 text-vialto-steel max-w-xl">
        Resumen operativo y financiero del tenant actual.
      </p>

      {error && (
        <div
          className="fixed top-4 right-4 z-50 max-w-sm rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-md"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-vialto-graphite p-6 flex flex-col justify-between min-h-[140px]">
          <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
            Clientes deudores
          </span>
          <div>
            <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
              {tablero === null && !error ? '—' : totalDeudores}
            </span>
            <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-vialto-bright tracking-wide">
              Saldo negativo en cuenta corriente
            </p>
          </div>
        </div>
        <div className="bg-vialto-graphite p-6 flex flex-col justify-between min-h-[140px]">
          <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
            Inconsistencias
          </span>
          <div>
            <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
              {tablero === null && !error ? '—' : totalInconsistencias}
            </span>
            <p className="mt-1 font-[family-name:var(--font-ui)] text-xs text-white/50 tracking-wide">
              Finalizados sin facturar (sin cargo en CC)
            </p>
          </div>
        </div>
        <div className="bg-vialto-graphite p-6 flex flex-col justify-between min-h-[140px] sm:col-span-2 lg:col-span-1">
          <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
            En curso {'>'} X horas
          </span>
          <p className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
            {tablero === null && !error ? '—' : totalViajesAtrasados}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <div className="bg-white border border-black/10 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-vialto-steel">Facturado mes actual</p>
          <div className="mt-2 space-y-1">
            <p className="font-[family-name:var(--font-display)] text-2xl text-vialto-charcoal leading-tight">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider text-vialto-steel block mb-0.5">
                ARS
              </span>
              {textoMontoPorMoneda('ARS', factActual, tableroListo)}
            </p>
            <p className="font-[family-name:var(--font-display)] text-xl text-vialto-charcoal/90 leading-tight">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider text-vialto-steel block mb-0.5">
                USD
              </span>
              {textoMontoPorMoneda('USD', factActual, tableroListo)}
            </p>
          </div>
        </div>
        <div className="bg-white border border-black/10 p-5">
          <p className="text-[11px] uppercase tracking-[0.2em] text-vialto-steel">Facturado mes anterior</p>
          <div className="mt-2 space-y-1">
            <p className="font-[family-name:var(--font-display)] text-2xl text-vialto-charcoal leading-tight">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider text-vialto-steel block mb-0.5">
                ARS
              </span>
              {textoMontoPorMoneda('ARS', factAnterior, tableroListo)}
            </p>
            <p className="font-[family-name:var(--font-display)] text-xl text-vialto-charcoal/90 leading-tight">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider text-vialto-steel block mb-0.5">
                USD
              </span>
              {textoMontoPorMoneda('USD', factAnterior, tableroListo)}
            </p>
          </div>
        </div>
      </div>

      <Link
        to="/viajes"
        className="mt-6 inline-flex font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.15em] text-vialto-fire hover:text-vialto-charcoal"
      >
        Ver todos los viajes →
      </Link>
    </div>
  );
}
