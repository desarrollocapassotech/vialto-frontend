import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';

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

function fmtFecha(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));
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

type CombustibleDashboardResponse = {
  totalCargas: number;
  totalLitros: number;
  totalImporte: number;
  precioPorLitro: number;
  litrosPorCarga: number;
  topEstaciones: Array<{ nombre: string; litros: number }>;
  topVehiculos: Array<{ patente: string; litros: number }>;
  ultimasCargas: Array<{
    id: string;
    fecha: string;
    litros: number;
    importe: number;
    km: number;
    estacion: string;
    formaPago: string | null;
    vehiculo: { patente: string } | null;
    chofer: { nombre: string } | null;
  }>;
};

export function DashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const maestro = useMaestroData();

  const [tablero, setTablero] = useState<TableroGeneralResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [combustibleMonth, setCombustibleMonth] = useState('');
  const [combustibleData, setCombustibleData] = useState<CombustibleDashboardResponse | null>(null);
  const [combustibleLoading, setCombustibleLoading] = useState(false);

  const hasCombustible = maestro.tenant?.modules?.includes('combustible') ?? false;

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

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !hasCombustible) return;
    let cancelled = false;
    setCombustibleLoading(true);
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (combustibleMonth) qs.set('month', combustibleMonth);
        const url = `/api/combustible/dashboard${qs.toString() ? '?' + qs.toString() : ''}`;
        const data = await apiJson<CombustibleDashboardResponse>(url, () => getToken());
        if (!cancelled) {
          setCombustibleData(data);
          setCombustibleLoading(false);
        }
      } catch {
        if (!cancelled) setCombustibleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, hasCombustible, combustibleMonth]);

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

      {hasCombustible && (
        <div className="mt-14">
          <div className="flex flex-wrap items-start gap-4 justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-vialto-charcoal">
                Combustible
              </h2>
              <p className="mt-1 text-sm text-vialto-steel">
                {combustibleMonth ? `Período: ${combustibleMonth}` : 'Todos los períodos'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={combustibleMonth}
                onChange={(e) => setCombustibleMonth(e.target.value)}
                className="h-9 border border-black/15 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none"
              />
              {combustibleMonth && (
                <button
                  type="button"
                  onClick={() => setCombustibleMonth('')}
                  className="h-9 px-3 border border-gray-200 text-gray-500 text-xs uppercase tracking-wider hover:bg-gray-50 transition-colors"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {combustibleLoading && !combustibleData && (
            <p className="mt-6 text-sm text-vialto-steel">Cargando...</p>
          )}

          {combustibleData && (
            <>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-vialto-graphite p-5 flex flex-col justify-between min-h-[110px]">
                  <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
                    Cargas
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-3xl text-white tracking-wide">
                    {combustibleData.totalCargas}
                  </span>
                </div>
                <div className="bg-vialto-graphite p-5 flex flex-col justify-between min-h-[110px]">
                  <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
                    Total litros
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-3xl text-white tracking-wide">
                    {combustibleData.totalLitros.toLocaleString('es-AR')} L
                  </span>
                </div>
                <div className="bg-vialto-graphite p-5 flex flex-col justify-between min-h-[110px]">
                  <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
                    Gasto total
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-3xl text-white tracking-wide">
                    $ {combustibleData.totalImporte.toLocaleString('es-AR')}
                  </span>
                </div>
                <div className="bg-vialto-graphite p-5 flex flex-col justify-between min-h-[110px]">
                  <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
                    Precio prom. / litro
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-3xl text-white tracking-wide">
                    $ {Math.round(combustibleData.precioPorLitro).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="bg-white border border-black/10 p-5 lg:col-span-2">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-vialto-steel mb-4">
                    Últimas cargas
                  </p>
                  {combustibleData.ultimasCargas.length === 0 ? (
                    <p className="text-sm text-vialto-steel">Sin cargas en el período.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-black/10">
                            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">Fecha</th>
                            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">Conductor</th>
                            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">Vehículo</th>
                            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">Litros</th>
                            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {combustibleData.ultimasCargas.map((c) => (
                            <tr key={c.id} className="border-b border-black/5 last:border-0">
                              <td className="py-2 text-vialto-charcoal">{fmtFecha(c.fecha)}</td>
                              <td className="py-2 text-vialto-charcoal">{c.chofer?.nombre ?? '—'}</td>
                              <td className="py-2 text-vialto-charcoal">{c.vehiculo?.patente ?? '—'}</td>
                              <td className="py-2 text-right text-vialto-charcoal">{c.litros.toLocaleString('es-AR')} L</td>
                              <td className="py-2 text-right text-vialto-charcoal">$ {c.importe.toLocaleString('es-AR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  {combustibleData.topEstaciones.length > 0 && (
                    <div className="bg-white border border-black/10 p-5">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-vialto-steel mb-3">
                        Top estaciones
                      </p>
                      <ul className="space-y-2">
                        {combustibleData.topEstaciones.map((e) => (
                          <li key={e.nombre} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-vialto-charcoal truncate">{e.nombre}</span>
                            <span className="shrink-0 text-vialto-steel">{e.litros.toLocaleString('es-AR')} L</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {combustibleData.topVehiculos.length > 0 && (
                    <div className="bg-white border border-black/10 p-5">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-vialto-steel mb-3">
                        Top vehículos
                      </p>
                      <ul className="space-y-2">
                        {combustibleData.topVehiculos.map((v) => (
                          <li key={v.patente} className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium text-vialto-charcoal">{v.patente}</span>
                            <span className="shrink-0 text-vialto-steel">{v.litros.toLocaleString('es-AR')} L</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <Link
                to="/combustible"
                className="mt-4 inline-flex font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.15em] text-vialto-fire hover:text-vialto-charcoal"
              >
                Ver todas las cargas →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
