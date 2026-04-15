import type { MetricCompare, OwnerDashboardResponse } from '@/types/ownerDashboard';
import type { useTenantOwnerDashboard } from '@/hooks/useTenantOwnerDashboard';
import {
  canAccessFacturacion,
  canAccessViajes,
} from '@/lib/tenantModules';

function formatMoney(n: number) {
  return `$ ${n.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Sin actividad en el período anterior → no mostrar % de variación. */
function hasPreviousPeriodData(previous: number): boolean {
  return Math.abs(previous) > 0.0005;
}

function CompareLine({ m }: { m: MetricCompare }) {
  if (!hasPreviousPeriodData(m.previous)) {
    return (
      <span
        className="text-xs text-white/35 min-h-4 block"
        title="Sin datos en el período anterior para comparar"
      />
    );
  }
  const color =
    m.sentiment === 'positive'
      ? 'text-emerald-400'
      : m.sentiment === 'negative'
        ? 'text-rose-400'
        : 'text-white/50';
  const pct =
    m.changePct === null
      ? '—'
      : `${m.changePct > 0 ? '+' : ''}${m.changePct.toLocaleString('es-AR', {
          maximumFractionDigits: 1,
        })}%`;
  return (
    <span className={`text-xs font-medium ${color}`}>
      {pct} vs período anterior
    </span>
  );
}

function MetricCard({
  title,
  caption,
  metric,
  loading,
  formatValue = formatMoney,
  omitCompare,
  snapshotFootnote,
  valueTone,
}: {
  title: string;
  caption?: string;
  metric: MetricCompare | undefined;
  loading: boolean;
  formatValue?: (n: number) => string;
  omitCompare?: boolean;
  snapshotFootnote?: string;
  /** Verde si el monto actual &gt; 0 (ingreso). Rojo si &gt; 0 (egreso / obligación). */
  valueTone?: 'default' | 'positiveCash' | 'payable';
}) {
  const m = metric ?? {
    current: 0,
    previous: 0,
    changePct: 0,
    sentiment: 'neutral' as const,
  };
  const valueColorClass =
    !loading && m.current > 0
      ? valueTone === 'positiveCash'
        ? 'text-emerald-400'
        : valueTone === 'payable'
          ? 'text-rose-400'
          : 'text-white'
      : 'text-white';
  return (
    <div className="bg-vialto-charcoal p-5 min-h-[120px] flex flex-col justify-between">
      <div>
        <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
          {title}
        </span>
        {caption ? (
          <p className="mt-1.5 text-[11px] leading-snug text-white/30 normal-case tracking-normal">
            {caption}
          </p>
        ) : null}
      </div>
      <span
        className={`font-[family-name:var(--font-display)] text-4xl tracking-wide ${valueColorClass}`}
      >
        {loading ? '—' : formatValue(m.current)}
      </span>
      <span className="text-xs leading-snug min-h-4">
        {loading ? (
          <span className="text-white/35">…</span>
        ) : omitCompare ? (
          <span className="text-white/35">{snapshotFootnote ?? ''}</span>
        ) : (
          <CompareLine m={m} />
        )}
      </span>
    </div>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

export function AlertsPanel({ alertas }: { alertas: NonNullable<OwnerDashboardResponse['alertas']> }) {
  return (
    <aside
      aria-labelledby="alertas-heading"
      className="lg:w-80 shrink-0 rounded-lg border-2 border-vialto-fire/50 bg-gradient-to-br from-vialto-charcoal to-vialto-graphite p-4 shadow-lg ring-1 ring-vialto-fire/20"
    >
      <div className="flex items-center gap-2 mb-4">
        <BellIcon className="text-vialto-fire shrink-0 w-5 h-5" />
        <h2
          id="alertas-heading"
          className="font-[family-name:var(--font-display)] text-lg tracking-wide text-white"
        >
          Alertas
        </h2>
      </div>
      <div className="flex flex-col gap-3">
        {alertas.facturasVencidas.cantidad > 0 && (
          <div className="rounded-md border-2 border-rose-500/70 bg-rose-950/35 px-3 py-3 flex gap-3">
            <AlertTriangleIcon className="text-rose-400 shrink-0 mt-0.5 w-5 h-5" />
            <div>
              <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-rose-200/80">
                {alertas.facturasVencidas.cantidad === 1
                  ? 'Factura vencida sin cobrar'
                  : 'Facturas vencidas sin cobrar'}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">
                {alertas.facturasVencidas.cantidad}{' '}
                <span className="text-base text-white/70 font-body">
                  {alertas.facturasVencidas.cantidad === 1 ? 'factura' : 'facturas'}
                </span>
              </p>
              <p className="text-xs text-rose-100/90 mt-0.5">
                Total: {formatMoney(alertas.facturasVencidas.montoTotal)}
              </p>
            </div>
          </div>
        )}
        {alertas.viajesSinFactura.cantidad > 0 && (
          <div className="rounded-md border-2 border-amber-500/70 bg-amber-950/30 px-3 py-3 flex gap-3">
            <AlertTriangleIcon className="text-amber-400 shrink-0 mt-0.5 w-5 h-5" />
            <div>
              <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
                {alertas.viajesSinFactura.cantidad === 1
                  ? 'Viaje finalizado sin factura'
                  : 'Viajes finalizados sin factura'}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">
                {alertas.viajesSinFactura.cantidad}{' '}
                <span className="text-base text-white/70 font-body">
                  {alertas.viajesSinFactura.cantidad === 1 ? 'viaje' : 'viajes'}
                </span>
              </p>
              <p className="text-xs text-amber-100/90 mt-0.5">
                Monto referido: {formatMoney(alertas.viajesSinFactura.montoTotal)}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

interface TenantOwnerDashboardProps {
  modules: string[];
  dash: ReturnType<typeof useTenantOwnerDashboard>;
}

export function TenantOwnerDashboard({ modules, dash }: TenantOwnerDashboardProps) {
  const showFin = canAccessFacturacion(modules);
  const showViajes = canAccessViajes(modules);

  const periodTabs: { id: typeof dash.period; label: string }[] = [
    { id: 'week', label: 'Esta semana' },
    { id: 'month', label: 'Este mes' },
    { id: '3months', label: 'Últimos 3 meses' },
    { id: 'custom', label: 'Personalizado' },
  ];

  const hasAnyBlock = showFin || showViajes;
  const fin = dash.data?.financiero;
  const viajes = dash.data?.viajes;

  return (
    <div className="mt-8 space-y-10">
      <div className="flex flex-col gap-4">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Período del panel"
        >
          {periodTabs.map((t) => {
            const active = dash.period === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => dash.setPeriod(t.id)}
                className={`rounded border px-4 py-2 text-sm font-[family-name:var(--font-ui)] uppercase tracking-wider transition-colors ${
                  active
                    ? 'border-vialto-fire bg-vialto-charcoal text-vialto-fire'
                    : 'border-vialto-steel/40 bg-white text-vialto-steel hover:border-vialto-fire/50'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {dash.period === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-vialto-steel">
              Desde
              <input
                type="date"
                className="rounded border border-vialto-steel/40 bg-white px-3 py-2 text-sm text-vialto-charcoal"
                value={dash.customFrom}
                onChange={(e) => dash.setCustomFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-vialto-steel">
              Hasta
              <input
                type="date"
                className="rounded border border-vialto-steel/40 bg-white px-3 py-2 text-sm text-vialto-charcoal"
                value={dash.customTo}
                onChange={(e) => dash.setCustomTo(e.target.value)}
              />
            </label>
            {(!dash.customFrom || !dash.customTo) && (
              <p className="text-xs text-vialto-steel">
                Elegí fecha desde y hasta para ver los indicadores.
              </p>
            )}
          </div>
        )}
      </div>

      {dash.error && (
        <div
          className="rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {dash.error}
        </div>
      )}

      {!hasAnyBlock && (
        <p className="text-vialto-steel text-sm max-w-xl">
          Los resúmenes de negocio aparecen cuando tenés activos los módulos de
          facturación y/o viajes.
        </p>
      )}

      {showFin && (
        <section aria-labelledby="fin-heading">
          <h2
            id="fin-heading"
            className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.2em] text-vialto-steel mb-3"
          >
            Resumen financiero
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="A pagar (transportistas externos)"
              metric={fin?.aPagarTransportistas}
              loading={dash.loading}
              valueTone="payable"
            />
            <MetricCard
              title="Sin facturar"
              metric={fin?.sinFacturarPeriodo}
              loading={dash.loading}
            />
            <MetricCard
              title="Facturado"
              metric={fin?.facturado}
              loading={dash.loading}
            />
            <MetricCard
              title="Cobrado"
              metric={fin?.cobrado}
              loading={dash.loading}
              valueTone="positiveCash"
            />
          </div>
          {!dash.loading && fin?.mostrarDiferenciaNeta && (
            <div className="mt-2 bg-vialto-graphite border border-white/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/45">
                Diferencia neta estimada
              </span>
              <div className="flex flex-col sm:items-end gap-1">
                <span className="font-[family-name:var(--font-display)] text-3xl text-white tracking-wide">
                  {formatMoney(fin.diferenciaNetaEstimada)}
                </span>
                <CompareLine m={fin.diferenciaNetaCompare} />
              </div>
            </div>
          )}
        </section>
      )}

      {showViajes && (
        <section aria-labelledby="viajes-heading">
          <h2
            id="viajes-heading"
            className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.2em] text-vialto-steel mb-3"
          >
            Actividad operativa
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-2">
            <MetricCard
              title="Viajes en curso (ahora)"
              metric={viajes?.enCurso}
              loading={dash.loading}
              formatValue={(n) => String(Math.round(n))}
            />
            <MetricCard
              title="Viajes completados (período)"
              metric={viajes?.completados}
              loading={dash.loading}
              formatValue={(n) => String(Math.round(n))}
            />
          </div>
        </section>
      )}
    </div>
  );
}
