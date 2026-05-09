import type { MetricCompare, OwnerDashboardResponse } from '@/types/ownerDashboard';
import type { useTenantOwnerDashboard } from '@/hooks/useTenantOwnerDashboard';
import {
  canAccessFacturacion,
  canAccessViajes,
} from '@/lib/tenantModules';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';

function formatMoney(n: number) {
  return `$ ${n.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatMoneyUSD(n: number) {
  return `USD ${n.toLocaleString('es-AR', {
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
  tooltip,
  metric,
  loading,
  formatValue = formatMoney,
  omitCompare,
  snapshotFootnote,
  valueTone,
}: {
  title: string;
  caption?: string;
  tooltip?: string;
  metric: MetricCompare | undefined;
  loading: boolean;
  formatValue?: (n: number) => string;
  omitCompare?: boolean;
  snapshotFootnote?: string;
  valueTone?: 'default' | 'positiveCash' | 'payable';
}) {
  const m = metric ?? {
    current: 0,
    previous: 0,
    changePct: 0,
    sentiment: 'neutral' as const,
  };
  const dual = m.currencies != null;
  const arsAmount = m.currencies?.ARS ?? 0;
  const usdAmount = m.currencies?.USD ?? 0;
  const primaryAmount = dual ? arsAmount + usdAmount : m.current;

  const valueColorClass =
    !loading && primaryAmount > 0
      ? valueTone === 'positiveCash'
        ? 'text-emerald-400'
        : valueTone === 'payable'
          ? 'text-rose-400'
          : 'text-white'
      : 'text-white';

  return (
    <div className="bg-vialto-charcoal p-5 min-h-[120px] flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-wide text-white/80">
            {title}
          </span>
          {tooltip && (
            <span title={tooltip} className="cursor-help text-white/25 hover:text-white/50 transition-colors text-[11px] leading-none select-none">
              ⓘ
            </span>
          )}
        </div>
        {caption ? (
          <p className="mt-1.5 text-[11px] leading-snug text-white/30 normal-case tracking-normal">
            {caption}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5">
        {loading ? (
          <span className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-white">—</span>
        ) : dual ? (
          <div className="flex flex-col gap-1.5">
            <div>
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em] text-white/40 block mb-0.5">
                ARS
              </span>
              <span className={`font-[family-name:var(--font-display)] text-3xl tracking-wide block leading-tight ${valueColorClass}`}>
                {arsAmount === 0 ? '—' : formatMoney(arsAmount)}
              </span>
            </div>
            <div>
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em] text-white/40 block mb-0.5">
                USD
              </span>
              <span className={`font-[family-name:var(--font-display)] text-2xl tracking-wide block leading-tight ${valueColorClass}`}>
                {usdAmount === 0 ? '—' : formatMoneyUSD(usdAmount)}
              </span>
            </div>
          </div>
        ) : (
          <span className={`font-[family-name:var(--font-display)] text-4xl tracking-wide ${valueColorClass}`}>
            {formatValue(m.current)}
          </span>
        )}
      </div>

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

function montosPorMonedaCompat(
  bloque: { montoTotal: number; montosPorMoneda?: { ARS: number; USD: number } },
): { ARS: number; USD: number } {
  const m = bloque.montosPorMoneda;
  if (m != null && typeof m.ARS === 'number' && typeof m.USD === 'number') {
    return m;
  }
  return { ARS: bloque.montoTotal, USD: 0 };
}

export function AlertsPanel({ alertas }: { alertas: NonNullable<OwnerDashboardResponse['alertas']> }) {
  const [abierto, setAbierto] = useState(false);
  const headingId = useId();
  const panelId = `${headingId}-panel`;
  const vencMon = montosPorMonedaCompat(alertas.facturasVencidas);
  const sinFacturaMon = montosPorMonedaCompat(alertas.viajesSinFactura);
  const itemsFacturasVencidas = alertas.facturasVencidas.items ?? [];
  const itemsViajesSinFactura = alertas.viajesSinFactura.items ?? [];
  const totalAlertasBadge =
    (alertas.facturasVencidas.cantidad > 0 ? alertas.facturasVencidas.cantidad : 0) +
    (alertas.viajesSinFactura.cantidad > 0 ? alertas.viajesSinFactura.cantidad : 0);
  const badgeText = totalAlertasBadge > 99 ? '99+' : String(totalAlertasBadge);

  const linkFacturaClass =
    'inline-flex w-full items-center justify-center rounded border border-rose-400/40 bg-rose-950/40 px-2 py-2 text-center font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-rose-100 hover:bg-rose-900/55 hover:border-rose-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 transition-colors';
  const linkViajeClass =
    'inline-flex w-full items-center justify-center rounded border border-amber-400/40 bg-amber-950/30 px-2 py-2 text-center font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-amber-100 hover:bg-amber-900/40 hover:border-amber-300/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors';

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  const listaAlertas = (
    <div className="flex flex-col gap-3">
      {alertas.facturasVencidas.cantidad > 0 && (
        <div className="rounded-md border-2 border-rose-500/70 bg-rose-950/35 px-3 py-3 flex gap-3">
          <AlertTriangleIcon className="text-rose-400 shrink-0 mt-0.5 w-5 h-5" />
          <div className="min-w-0 flex-1">
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
            <div className="text-xs text-rose-100/90 mt-1 space-y-0.5">
              <p>
                <span className="text-rose-200/70 uppercase tracking-wider text-[10px] mr-1.5">ARS</span>
                {vencMon.ARS === 0 ? '—' : formatMoney(vencMon.ARS)}
              </p>
              <p>
                <span className="text-rose-200/70 uppercase tracking-wider text-[10px] mr-1.5">USD</span>
                {vencMon.USD === 0 ? '—' : formatMoneyUSD(vencMon.USD)}
              </p>
            </div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {itemsFacturasVencidas.length > 0 ? (
                itemsFacturasVencidas.map((it) => (
                  <Link
                    key={it.id}
                    to={`/facturacion?factura=${encodeURIComponent(it.id)}`}
                    className={linkFacturaClass}
                    onClick={() => setAbierto(false)}
                  >
                    Factura {it.numero.trim() || it.id.slice(0, 8)} →
                  </Link>
                ))
              ) : (
                <Link
                  to="/facturacion"
                  className={linkFacturaClass}
                  onClick={() => setAbierto(false)}
                >
                  Ir a facturación →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
      {alertas.viajesSinFactura.cantidad > 0 && (
        <div className="rounded-md border-2 border-amber-500/70 bg-amber-950/30 px-3 py-3 flex gap-3">
          <AlertTriangleIcon className="text-amber-400 shrink-0 mt-0.5 w-5 h-5" />
          <div className="min-w-0 flex-1">
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
            <div className="text-xs text-amber-100/90 mt-1 space-y-0.5">
              <p>
                <span className="text-amber-200/70 uppercase tracking-wider text-[10px] mr-1.5">ARS</span>
                {sinFacturaMon.ARS === 0 ? '—' : formatMoney(sinFacturaMon.ARS)}
              </p>
              <p>
                <span className="text-amber-200/70 uppercase tracking-wider text-[10px] mr-1.5">USD</span>
                {sinFacturaMon.USD === 0 ? '—' : formatMoneyUSD(sinFacturaMon.USD)}
              </p>
            </div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {itemsViajesSinFactura.length > 0 ? (
                itemsViajesSinFactura.map((it) => (
                  <Link
                    key={it.id}
                    to={`/viajes?viaje=${encodeURIComponent(it.id)}`}
                    className={linkViajeClass}
                    onClick={() => setAbierto(false)}
                  >
                    Viaje {it.numero.trim() || it.id.slice(0, 8)} →
                  </Link>
                ))
              ) : (
                <Link to="/viajes" className={linkViajeClass} onClick={() => setAbierto(false)}>
                  Ir a viajes →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (!abierto) {
    return (
      <div className="shrink-0 self-start">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-expanded="false"
          aria-controls={panelId}
          aria-label={`Alertas: ${totalAlertasBadge} pendiente${totalAlertasBadge === 1 ? '' : 's'}, ver detalle`}
          className="group flex items-center gap-2.5 rounded-lg border-2 border-vialto-fire bg-gradient-to-br from-vialto-charcoal to-vialto-graphite px-4 py-2.5 text-left shadow-md ring-1 ring-vialto-fire/35 animate-alarm-chip-pulse motion-reduce:animate-none hover:border-vialto-bright hover:ring-vialto-fire/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-vialto-fire focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-vialto-mist)] active:scale-[0.98] transition-[border-color,box-shadow,transform] cursor-pointer"
        >
          <span
            className="inline-flex text-vialto-fire motion-reduce:animate-none animate-alarm-bell origin-top"
            aria-hidden
          >
            <BellIcon className="w-6 h-6" />
          </span>
          <span className="inline-flex items-center gap-2.5 pl-1">
            <span
              id={headingId}
              className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.2em] text-white group-hover:text-vialto-bright transition-colors"
            >
              Alertas
            </span>
            {totalAlertasBadge > 0 ? (
              <span
                className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-vialto-fire px-1.5 font-[family-name:var(--font-body)] text-[10px] font-bold leading-none text-white shadow ring-2 ring-vialto-charcoal"
                aria-hidden
              >
                {badgeText}
              </span>
            ) : null}
          </span>
        </button>
      </div>
    );
  }

  return (
    <aside
      id={panelId}
      role="region"
      aria-labelledby={headingId}
      className="w-full max-w-md lg:w-80 shrink-0 rounded-lg border-2 border-vialto-fire/50 bg-gradient-to-br from-vialto-charcoal to-vialto-graphite p-4 shadow-lg ring-1 ring-vialto-fire/20"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex text-vialto-fire shrink-0" aria-hidden>
            <BellIcon className="w-5 h-5" />
          </span>
          <h2
            id={headingId}
            className="font-[family-name:var(--font-display)] text-lg tracking-wide text-white min-w-0 inline-flex items-center gap-2.5 pl-1"
          >
            <span className="max-w-[10rem] truncate sm:max-w-[14rem]">Alertas</span>
            {totalAlertasBadge > 0 ? (
              <span
                className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-vialto-fire px-1.5 font-[family-name:var(--font-body)] text-[10px] font-bold leading-none text-white shadow ring-2 ring-vialto-charcoal"
                aria-hidden
              >
                {badgeText}
              </span>
            ) : null}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-expanded="true"
          aria-controls={panelId}
          className="shrink-0 rounded border border-white/20 bg-white/5 px-2.5 py-1 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-vialto-fire transition-colors"
        >
          Minimizar
        </button>
      </div>
      {listaAlertas}
    </aside>
  );
}

interface TenantOwnerDashboardProps {
  modules: string[];
  dash: ReturnType<typeof useTenantOwnerDashboard>;
}

export function TenantOwnerDashboard({ modules, dash }: TenantOwnerDashboardProps) {
  const showViajes = canAccessViajes(modules);
  const showFin = canAccessFacturacion(modules) || showViajes;

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
              tooltip="Suma del precio acordado con transportistas externos en viajes del período"
              metric={fin?.aPagarTransportistas}
              loading={dash.loading}
              valueTone="payable"
            />
            <MetricCard
              title="Sin facturar"
              tooltip="Monto de viajes finalizados o en curso sin factura emitida, atribuidos al período por fecha de carga"
              metric={fin?.sinFacturarPeriodo}
              loading={dash.loading}
            />
            <MetricCard
              title="Facturado"
              tooltip="Suma de facturas emitidas al cliente en el período, por fecha de emisión"
              metric={fin?.facturado}
              loading={dash.loading}
            />
            <MetricCard
              title="Cobrado"
              tooltip="Pagos recibidos de clientes en el período, más viajes cobrados sin pago explícito registrado"
              metric={fin?.cobrado}
              loading={dash.loading}
              valueTone="positiveCash"
            />
          </div>
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
              tooltip="Cantidad de viajes con estado en curso en este momento"
              metric={viajes?.enCurso}
              loading={dash.loading}
              formatValue={(n) => String(Math.round(n))}
            />
            <MetricCard
              title="Viajes completados (período)"
              tooltip="Viajes finalizados, facturados o cobrados cuya fecha de cierre cae dentro del período"
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
