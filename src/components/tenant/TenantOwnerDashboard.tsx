import type { MetricCompare, OwnerDashboardResponse } from '@/types/ownerDashboard';
import type { useTenantOwnerDashboard } from '@/hooks/useTenantOwnerDashboard';
import {
  canAccessFacturacion,
  canAccessViajes,
  canAccessStock,
  canAccessCombustible,
  canAccessIntegracionArca,
} from '@/lib/tenantModules';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Wallet, Warehouse, Fuel, type LucideIcon } from 'lucide-react';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';
import { modalOverlayClass } from '@/lib/modalLayers';
import { SelectorOpcionesSheet, selectorTriggerClass } from '@/components/ui/SelectorOpcionesSheet';
import { CombustibleDashboardSection } from '@/components/combustible/CombustibleDashboardSection';
import { FinancieroDashboardSection } from '@/components/financiero/FinancieroDashboardSection';
import { soloCiudadDesdeEtiquetaUbicacion } from '@/lib/ciudades/soloCiudadDesdeEtiqueta';

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

function fmtFechaCorta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

function MetricCard({
  title,
  caption,
  tooltip,
  metric,
  loading,
  formatValue = formatMoney,
  valueTone,
  linkTo,
  alwaysLink,
  simpleCount,
  className = '',
}: {
  title: string;
  caption?: string;
  tooltip?: string;
  metric?: MetricCompare;
  loading: boolean;
  formatValue?: (n: number) => string;
  valueTone?: 'default' | 'positiveCash' | 'payable' | 'warn';
  linkTo?: string;
  alwaysLink?: boolean;
  /** Muestra un conteo simple en lugar de la métrica comparativa. */
  simpleCount?: number;
  className?: string;
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
  const primaryAmount = dual ? arsAmount + usdAmount : (simpleCount ?? m.current);

  const valueColorClass =
    !loading && primaryAmount > 0
      ? valueTone === 'positiveCash'
        ? 'text-emerald-400'
        : valueTone === 'payable'
          ? 'text-rose-400'
          : valueTone === 'warn'
            ? 'text-amber-400'
            : 'text-white'
      : 'text-white';

  const effectiveCount = simpleCount !== undefined ? simpleCount : m.current;
  const showLink = !!linkTo && !loading && (alwaysLink || effectiveCount > 0);
  const spanClass = dual ? 'col-span-2 lg:col-span-1' : '';
  const cardClass = [
    'group bg-vialto-charcoal',
    'flex flex-row items-center gap-2.5 p-3',
    'lg:flex-col lg:items-stretch lg:justify-between lg:gap-0 lg:p-5 lg:min-h-[120px]',
    showLink ? 'hover:bg-vialto-graphite transition-colors cursor-pointer' : '',
    spanClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const valueBlock = loading ? (
    <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-white lg:text-4xl">
      —
    </span>
  ) : simpleCount !== undefined ? (
    <span
      className={`font-[family-name:var(--font-display)] text-2xl tracking-wide lg:text-4xl ${valueColorClass}`}
    >
      {String(Math.round(simpleCount))}
    </span>
  ) : dual ? (
    <div className="flex flex-col items-end gap-0.5 text-right lg:items-stretch lg:text-left lg:gap-1.5">
      <div>
        <span className="mb-0.5 block font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.18em] text-white/40 lg:text-[10px]">
          ARS
        </span>
        <span
          className={`block font-[family-name:var(--font-display)] text-lg leading-tight tracking-wide lg:text-3xl ${valueColorClass}`}
        >
          {arsAmount === 0 ? '—' : formatMoney(arsAmount)}
        </span>
      </div>
      <div>
        <span className="mb-0.5 block font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.18em] text-white/40 lg:text-[10px]">
          USD
        </span>
        <span
          className={`block font-[family-name:var(--font-display)] text-base leading-tight tracking-wide lg:text-2xl ${valueColorClass}`}
        >
          {usdAmount === 0 ? '—' : formatMoneyUSD(usdAmount)}
        </span>
      </div>
    </div>
  ) : (
    <span
      className={`font-[family-name:var(--font-display)] text-xl tracking-wide lg:text-4xl ${valueColorClass}`}
    >
      {formatValue(m.current)}
    </span>
  );

  const inner = (
    <>
      <div className="min-w-0 flex-1 lg:flex-none">
        <div className="flex items-start gap-1">
          <span className="line-clamp-2 font-[family-name:var(--font-ui)] text-[11px] uppercase leading-snug tracking-wide text-white/80 lg:line-clamp-none lg:text-sm">
            {title}
          </span>
          {tooltip && (
            <span
              title={tooltip}
              className="mt-0.5 shrink-0 cursor-help select-none text-[10px] leading-none text-white/25 transition-colors hover:text-white/50 lg:text-[11px]"
            >
              ⓘ
            </span>
          )}
        </div>
        {caption ? (
          <p className="mt-1.5 hidden text-[11px] leading-snug tracking-normal text-white/30 normal-case lg:block">
            {caption}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-0.5 lg:mt-auto lg:items-stretch">
        {valueBlock}
        {showLink && (
          <span className="font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.15em] text-white/40 transition-colors group-hover:text-white/80 lg:flex lg:justify-end lg:text-[10px]">
            Ver →
          </span>
        )}
      </div>
    </>
  );

  if (showLink) {
    return (
      <Link to={linkTo!} className={cardClass}>
        {inner}
      </Link>
    );
  }
  return <div className={cardClass}>{inner}</div>;
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

export function AlertsPanel({ alertas, onViewFactura, loadingFacturaId, onViewViaje, loadingViajeId, shouldClose }: { alertas: NonNullable<OwnerDashboardResponse['alertas']>; onViewFactura?: (id: string) => void; loadingFacturaId?: string | null; onViewViaje?: (id: string) => void; loadingViajeId?: string | null; shouldClose?: boolean }) {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (shouldClose) setAbierto(false);
  }, [shouldClose]);

  useLockBodyScroll(abierto);

  useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto]);

  const headingId = useId();
  const panelId = `${headingId}-panel`;
  const vencMon = montosPorMonedaCompat(alertas.facturasVencidas);
  const sinFacturaMon = montosPorMonedaCompat(alertas.viajesSinFactura);
  const itemsFacturasVencidas = alertas.facturasVencidas.items ?? [];
  const itemsViajesSinFactura = alertas.viajesSinFactura.items ?? [];
  const cargasSospechosas = alertas.cargasSospechosas ?? { cantidad: 0, montoTotal: 0 };
  const margenBajo = alertas.margenBajo ?? { cantidad: 0, montoTotal: 0 };
  const totalAlertasBadge =
    (alertas.facturasVencidas.cantidad > 0 ? alertas.facturasVencidas.cantidad : 0) +
    (alertas.viajesSinFactura.cantidad > 0 ? alertas.viajesSinFactura.cantidad : 0) +
    (cargasSospechosas.cantidad > 0 ? cargasSospechosas.cantidad : 0) +
    (margenBajo.cantidad > 0 ? margenBajo.cantidad : 0);
  const badgeText = totalAlertasBadge > 99 ? '99+' : String(totalAlertasBadge);
  const resumenMobile =
    totalAlertasBadge === 1
      ? '1 pendiente'
      : `${totalAlertasBadge} pendientes`;

  function closePanel() {
    setAbierto(false);
  }

  function renderAlertActions(
    tone: 'rose' | 'amber',
    items: Array<{ id: string; numero: string }>,
    fallbackTo: string,
    fallbackLabel: string,
    itemPrefix: string,
    onView?: (id: string) => void,
    loadingId?: string | null,
  ) {
    const linkClass =
      tone === 'rose'
        ? 'inline-flex min-h-11 w-full items-center justify-center rounded border border-rose-400/40 bg-rose-950/40 px-2 py-2 text-center font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-rose-100 hover:bg-rose-900/55 hover:border-rose-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 transition-colors'
        : 'inline-flex min-h-11 w-full items-center justify-center rounded border border-amber-400/40 bg-amber-950/30 px-2 py-2 text-center font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-amber-100 hover:bg-amber-900/40 hover:border-amber-300/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors';
    const spinnerClass =
      tone === 'rose'
        ? 'inline-block h-3 w-3 animate-spin rounded-full border-2 border-rose-300 border-t-transparent'
        : 'inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-transparent';

    return (
      <div className="mt-3 flex flex-col gap-2">
        {items.length > 0 ? (
          items.map((it) =>
            onView ? (
              <button
                key={it.id}
                type="button"
                disabled={loadingId === it.id}
                className={`${linkClass} disabled:opacity-60 disabled:cursor-wait`}
                onClick={() => onView(it.id)}
              >
                {loadingId === it.id ? (
                  <span className="flex items-center gap-1.5">
                    <span className={spinnerClass} />
                    Cargando…
                  </span>
                ) : (
                  <>{itemPrefix} {it.numero.trim() || it.id.slice(0, 8)} →</>
                )}
              </button>
            ) : (
              <Link
                key={it.id}
                to={tone === 'rose' ? `/facturacion?factura=${encodeURIComponent(it.id)}` : `/viajes?viaje=${encodeURIComponent(it.id)}`}
                className={linkClass}
                onClick={closePanel}
              >
                {itemPrefix} {it.numero.trim() || it.id.slice(0, 8)} →
              </Link>
            ),
          )
        ) : (
          <Link to={fallbackTo} className={linkClass} onClick={closePanel}>
            {fallbackLabel}
          </Link>
        )}
      </div>
    );
  }

  function renderViajesSinFacturaActions() {
    const linkClass =
      'flex w-full flex-col gap-0.5 rounded border border-amber-400/40 bg-amber-950/30 px-2 py-1.5 text-left hover:bg-amber-900/40 hover:border-amber-300/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors disabled:cursor-wait disabled:opacity-60';
    const spinnerClass =
      'inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-transparent';

    if (itemsViajesSinFactura.length === 0) {
      return (
        <div className="mt-3 flex flex-col gap-2">
          <Link
            to="/viajes"
            className="inline-flex min-h-11 w-full items-center justify-center rounded border border-amber-400/40 bg-amber-950/30 px-2 py-2 text-center font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-amber-100 hover:bg-amber-900/40 hover:border-amber-300/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
            onClick={closePanel}
          >
            Ir a viajes →
          </Link>
        </div>
      );
    }

    return (
      <div className="mt-3 flex flex-col gap-1.5">
        {itemsViajesSinFactura.map((it) => {
          const fecha = fmtFechaCorta(it.fecha);
          const ruta =
            it.origen || it.destino
              ? `${soloCiudadDesdeEtiquetaUbicacion(it.origen)} → ${soloCiudadDesdeEtiquetaUbicacion(it.destino)}`
              : null;
          const cargando = loadingViajeId === it.id;
          const contenido = (
            <>
              <span className="flex items-center justify-between gap-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.1em] text-amber-100">
                <span className="truncate">
                  {fecha ?? '—'} · {it.clienteNombre ?? 'Cliente'}
                </span>
                {!cargando && <span className="shrink-0">→</span>}
              </span>
              {cargando ? (
                <span className="flex items-center gap-1.5 text-[10px] text-amber-200/70">
                  <span className={spinnerClass} />
                  Cargando…
                </span>
              ) : (
                ruta && <span className="truncate text-[10px] text-amber-200/70">{ruta}</span>
              )}
            </>
          );
          return onViewViaje ? (
            <button
              key={it.id}
              type="button"
              disabled={cargando}
              onClick={() => onViewViaje(it.id)}
              className={linkClass}
            >
              {contenido}
            </button>
          ) : (
            <Link
              key={it.id}
              to={`/viajes?viaje=${encodeURIComponent(it.id)}`}
              className={linkClass}
              onClick={closePanel}
            >
              {contenido}
            </Link>
          );
        })}
      </div>
    );
  }

  function renderAlertList() {
    return (
      <div className="flex flex-col gap-3">
        {alertas.facturasVencidas.cantidad > 0 && (
          <div className="flex gap-3 rounded-md border-2 border-rose-500/70 bg-rose-950/35 px-3 py-3">
            <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
            <div className="min-w-0 flex-1">
              <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-rose-200/80">
                {alertas.facturasVencidas.cantidad === 1
                  ? 'Factura vencida sin cobrar'
                  : 'Facturas vencidas sin cobrar'}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">
                {alertas.facturasVencidas.cantidad}{' '}
                <span className="font-body text-base text-white/70">
                  {alertas.facturasVencidas.cantidad === 1 ? 'factura' : 'facturas'}
                </span>
              </p>
              <div className="mt-1 space-y-0.5 text-xs text-rose-100/90">
                {vencMon.ARS !== 0 && (
                  <p>
                    <span className="mr-1.5 text-[10px] uppercase tracking-wider text-rose-200/70">ARS</span>
                    {formatMoney(vencMon.ARS)}
                  </p>
                )}
                {vencMon.USD !== 0 && (
                  <p>
                    <span className="mr-1.5 text-[10px] uppercase tracking-wider text-rose-200/70">USD</span>
                    {formatMoneyUSD(vencMon.USD)}
                  </p>
                )}
              </div>
              {renderAlertActions(
                'rose',
                itemsFacturasVencidas,
                '/facturacion',
                'Ir a facturación →',
                'Factura',
                onViewFactura,
                loadingFacturaId,
              )}
            </div>
          </div>
        )}

        {alertas.viajesSinFactura.cantidad > 0 && (
          <div className="flex gap-3 rounded-md border-2 border-amber-500/70 bg-amber-950/30 px-3 py-3">
            <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
                {alertas.viajesSinFactura.cantidad === 1
                  ? 'Viaje finalizado sin factura'
                  : 'Viajes finalizados sin factura'}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">
                {alertas.viajesSinFactura.cantidad}{' '}
                <span className="font-body text-base text-white/70">
                  {alertas.viajesSinFactura.cantidad === 1 ? 'viaje' : 'viajes'}
                </span>
              </p>
              <div className="mt-1 space-y-0.5 text-xs text-amber-100/90">
                {sinFacturaMon.ARS !== 0 && (
                  <p>
                    <span className="mr-1.5 text-[10px] uppercase tracking-wider text-amber-200/70">ARS</span>
                    {formatMoney(sinFacturaMon.ARS)}
                  </p>
                )}
                {sinFacturaMon.USD !== 0 && (
                  <p>
                    <span className="mr-1.5 text-[10px] uppercase tracking-wider text-amber-200/70">USD</span>
                    {formatMoneyUSD(sinFacturaMon.USD)}
                  </p>
                )}
              </div>
              {renderViajesSinFacturaActions()}
            </div>
          </div>
        )}

        {cargasSospechosas.cantidad > 0 && (
          <div className="flex gap-3 rounded-md border-2 border-amber-500/70 bg-amber-950/30 px-3 py-3">
            <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
                {cargasSospechosas.cantidad === 1
                  ? 'Carga de combustible sospechosa en el período'
                  : 'Cargas de combustible sospechosas en el período'}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">
                {cargasSospechosas.cantidad}{' '}
                <span className="font-body text-base text-white/70">
                  {cargasSospechosas.cantidad === 1 ? 'carga' : 'cargas'}
                </span>
              </p>
              <p className="mt-1 text-xs text-amber-100/90">
                {cargasSospechosas.montoTotal === 0 ? '—' : formatMoney(cargasSospechosas.montoTotal)}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  to="/?combustibleTab=alertas"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded border border-amber-400/40 bg-amber-950/30 px-2 py-2 text-center font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-amber-100 hover:bg-amber-900/40 hover:border-amber-300/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
                  onClick={closePanel}
                >
                  Ir a alertas de combustible →
                </Link>
              </div>
            </div>
          </div>
        )}

        {margenBajo.cantidad > 0 && (
          <div className="flex gap-3 rounded-md border-2 border-amber-500/70 bg-amber-950/30 px-3 py-3">
            <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
                {margenBajo.cantidad === 1
                  ? 'Viaje con margen bajo o negativo en el período'
                  : 'Viajes con margen bajo o negativo en el período'}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-white">
                {margenBajo.cantidad}{' '}
                <span className="font-body text-base text-white/70">
                  {margenBajo.cantidad === 1 ? 'viaje' : 'viajes'}
                </span>
              </p>
              <p className="mt-1 text-xs text-amber-100/90">
                {margenBajo.montoTotal === 0 ? '—' : formatMoney(margenBajo.montoTotal)}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  to="/?financieroTab=alertas"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded border border-amber-400/40 bg-amber-950/30 px-2 py-2 text-center font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-amber-100 hover:bg-amber-900/40 hover:border-amber-300/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
                  onClick={closePanel}
                >
                  Ir a alertas de margen →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="w-full lg:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          aria-label={`Alertas: ${resumenMobile}, ver detalle`}
          className="group flex min-h-11 w-full items-center gap-3 rounded-lg border-2 border-vialto-fire bg-gradient-to-br from-vialto-charcoal to-vialto-graphite px-4 py-3 text-left shadow-md ring-1 ring-vialto-fire/35 transition-[border-color,box-shadow] hover:border-vialto-bright hover:ring-vialto-fire/60"
        >
          <span
            className="inline-flex shrink-0 text-vialto-fire motion-reduce:animate-none animate-alarm-bell origin-top"
            aria-hidden
          >
            <BellIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.2em] text-white group-hover:text-vialto-bright transition-colors">
              Alertas
            </span>
            <span className="block text-xs text-white/60">{resumenMobile}</span>
          </span>
          <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-vialto-fire px-1.5 text-[10px] font-bold text-white ring-2 ring-vialto-charcoal">
            {badgeText}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-white/50" strokeWidth={2} />
        </button>
      </div>

      {abierto && (
        <div
          className={`${modalOverlayClass} lg:hidden`}
          role="presentation"
          onClick={closePanel}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${headingId}-mobile-title`}
            className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-xl border-2 border-vialto-fire/50 bg-gradient-to-br from-vialto-charcoal to-vialto-graphite shadow-lg ring-1 ring-vialto-fire/20 sm:max-w-md sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex shrink-0 text-vialto-fire" aria-hidden>
                  <BellIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2
                    id={`${headingId}-mobile-title`}
                    className="font-[family-name:var(--font-display)] text-lg tracking-wide text-white"
                  >
                    Alertas
                  </h2>
                  <p className="mt-0.5 text-xs text-white/50">{resumenMobile}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label="Cerrar"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-white/70 hover:bg-white/10 hover:text-white"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{renderAlertList()}</div>
            <div className="shrink-0 border-t border-white/10 p-4">
              <button
                type="button"
                onClick={closePanel}
                className="inline-flex min-h-11 w-full items-center justify-center rounded border border-white/20 bg-white/5 px-4 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-white hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden shrink-0 self-start lg:block">
        {!abierto ? (
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
        ) : (
          <aside
            id={panelId}
            role="region"
            aria-labelledby={headingId}
            className="fixed right-6 top-6 z-40 max-h-[calc(100dvh-3rem)] w-80 overflow-y-auto rounded-lg border-2 border-vialto-fire/50 bg-gradient-to-br from-vialto-charcoal to-vialto-graphite p-4 shadow-2xl ring-1 ring-vialto-fire/20"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex shrink-0 text-vialto-fire" aria-hidden>
                  <BellIcon className="h-5 w-5" />
                </span>
                <h2
                  id={headingId}
                  className="inline-flex min-w-0 items-center gap-2.5 pl-1 font-[family-name:var(--font-display)] text-lg tracking-wide text-white"
                >
                  <span className="max-w-[10rem] truncate">Alertas</span>
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
                onClick={closePanel}
                aria-expanded="true"
                aria-controls={panelId}
                className="shrink-0 rounded border border-white/20 bg-white/5 px-2.5 py-1 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-wider text-white/80 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-vialto-fire transition-colors"
              >
                Minimizar
              </button>
            </div>
            {renderAlertList()}
          </aside>
        )}
      </div>
    </>
  );
}

interface TenantOwnerDashboardProps {
  tenantId: string;
  modules: string[];
  dash: ReturnType<typeof useTenantOwnerDashboard>;
  onViewViaje?: (id: string) => void;
  loadingViajeId?: string | null;
}

type ModuloDashboardTab = 'financiero' | 'stock' | 'combustible';

export function TenantOwnerDashboard({ tenantId, modules, dash, onViewViaje, loadingViajeId }: TenantOwnerDashboardProps) {
  const showViajes = canAccessViajes(modules);
  const showFacturacionModulo = canAccessFacturacion(modules);
  const showStock = canAccessStock(modules);
  const showCombustible = canAccessCombustible(modules);
  const showIntegracionArca = canAccessIntegracionArca(modules);
  const showFinanciero = showViajes || showFacturacionModulo;
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [moduloSheetOpen, setModuloSheetOpen] = useState(false);

  const moduloTabs: { id: ModuloDashboardTab; label: string; icon: LucideIcon }[] = [
    ...(showFinanciero ? [{ id: 'financiero' as const, label: 'Financiero', icon: Wallet }] : []),
    ...(showStock ? [{ id: 'stock' as const, label: 'Stock', icon: Warehouse }] : []),
    ...(showCombustible ? [{ id: 'combustible' as const, label: 'Combustible', icon: Fuel }] : []),
  ];
  const [moduloTab, setModuloTab] = useState<ModuloDashboardTab | null>(null);
  const moduloActivo = moduloTab ?? moduloTabs[0]?.id ?? 'financiero';
  const moduloActivoDef = moduloTabs.find((t) => t.id === moduloActivo);
  const ModuloActivoIcon = moduloActivoDef?.icon;

  const periodTabs: { id: typeof dash.period; label: string }[] = [
    { id: 'week', label: 'Esta semana' },
    { id: 'month', label: 'Este mes' },
    { id: '3months', label: 'Últimos 3 meses' },
    { id: 'custom', label: 'Personalizado' },
  ];

  const activePeriodLabel =
    periodTabs.find((t) => t.id === dash.period)?.label ?? 'Período';

  useEffect(() => {
    if (!periodModalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPeriodModalOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [periodModalOpen]);

  useLockBodyScroll(periodModalOpen);

  function selectPeriod(id: typeof dash.period) {
    dash.setPeriod(id);
    if (id !== 'custom') setPeriodModalOpen(false);
  }

  return (
    <div className="mt-6 space-y-6 lg:mt-8 lg:space-y-10">
      <div className="flex flex-col gap-4">
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setPeriodModalOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={periodModalOpen}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-vialto-fire/40"
          >
            <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
              Período
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <span className="truncate font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-vialto-charcoal">
                {activePeriodLabel}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={2} />
            </span>
          </button>
        </div>

        {periodModalOpen && (
          <div
            className={modalOverlayClass}
            role="presentation"
            onClick={() => setPeriodModalOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="dashboard-period-title"
              className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-xl border border-black/10 bg-white shadow-lg sm:max-w-md sm:rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 py-4">
                <h2
                  id="dashboard-period-title"
                  className="font-[family-name:var(--font-display)] text-lg tracking-wide text-vialto-charcoal"
                >
                  Elegir período
                </h2>
                <button
                  type="button"
                  onClick={() => setPeriodModalOpen(false)}
                  aria-label="Cerrar"
                  className="inline-flex h-11 w-11 items-center justify-center text-vialto-steel hover:bg-vialto-mist"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {periodTabs.map((t) => {
                  const active = dash.period === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectPeriod(t.id)}
                      className={[
                        'flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors',
                        active
                          ? 'bg-vialto-mist text-vialto-charcoal'
                          : 'text-vialto-charcoal hover:bg-vialto-mist/70',
                      ].join(' ')}
                    >
                      <span className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider">
                        {t.label}
                      </span>
                      {active && (
                        <span className="text-vialto-fire text-sm font-semibold" aria-hidden>
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}

                {dash.period === 'custom' && (
                  <div className="mt-2 space-y-3 border-t border-black/10 px-3 py-4">
                    <label className="flex flex-col gap-1.5 text-xs text-vialto-steel">
                      Desde
                      <input
                        type="date"
                        className="min-h-11 w-full rounded border border-vialto-steel/40 bg-white px-3 py-2 text-sm text-vialto-charcoal"
                        value={dash.customFrom}
                        onChange={(e) => dash.setCustomFrom(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs text-vialto-steel">
                      Hasta
                      <input
                        type="date"
                        className="min-h-11 w-full rounded border border-vialto-steel/40 bg-white px-3 py-2 text-sm text-vialto-charcoal"
                        value={dash.customTo}
                        min={dash.customFrom || undefined}
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

              <div className="shrink-0 border-t border-black/10 p-4">
                <button
                  type="button"
                  onClick={() => setPeriodModalOpen(false)}
                  disabled={dash.period === 'custom' && (!dash.customFrom || !dash.customTo)}
                  className="inline-flex min-h-11 w-full items-center justify-center bg-vialto-charcoal px-4 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-white transition-colors hover:bg-vialto-graphite disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {dash.period === 'custom' ? 'Aplicar' : 'Listo'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div
          className="hidden flex-wrap gap-2 lg:flex"
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
          <div className="hidden flex-col gap-3 lg:flex lg:flex-row lg:flex-wrap lg:items-end lg:gap-3">
            <label className="flex w-full flex-col gap-1.5 text-xs text-vialto-steel lg:w-auto">
              Desde
              <input
                type="date"
                className="min-h-11 w-full rounded border border-vialto-steel/40 bg-white px-3 py-2 text-sm text-vialto-charcoal lg:min-h-0 lg:w-auto"
                value={dash.customFrom}
                onChange={(e) => dash.setCustomFrom(e.target.value)}
              />
            </label>
            <label className="flex w-full flex-col gap-1.5 text-xs text-vialto-steel lg:w-auto">
              Hasta
              <input
                type="date"
                className="min-h-11 w-full rounded border border-vialto-steel/40 bg-white px-3 py-2 text-sm text-vialto-charcoal lg:min-h-0 lg:w-auto"
                value={dash.customTo}
                onChange={(e) => dash.setCustomTo(e.target.value)}
              />
            </label>
            {(!dash.customFrom || !dash.customTo) && (
              <p className="text-xs text-vialto-steel lg:self-center">
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

      {moduloTabs.length > 1 && (
        <div className="border-b border-black/15">
          <div className="pb-3 lg:hidden">
            <button
              type="button"
              onClick={() => setModuloSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moduloSheetOpen}
              className={selectorTriggerClass}
            >
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Módulo
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                {ModuloActivoIcon && (
                  <ModuloActivoIcon
                    className="h-4 w-4 shrink-0 text-vialto-steel"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                )}
                <span className="truncate font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-vialto-charcoal">
                  {moduloActivoDef?.label ?? ''}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={2} aria-hidden />
              </span>
            </button>
            <SelectorOpcionesSheet
              open={moduloSheetOpen}
              onClose={() => setModuloSheetOpen(false)}
              title="Elegir módulo"
              options={moduloTabs.map((t) => ({ id: t.id, label: t.label }))}
              activeId={moduloActivo}
              onSelect={(id) => {
                setModuloTab(id as ModuloDashboardTab);
                setModuloSheetOpen(false);
              }}
            />
          </div>

          <nav className="-mb-px hidden gap-1 overflow-x-auto lg:flex" aria-label="Módulos del dashboard">
            {moduloTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setModuloTab(tab.id)}
                className={[
                  'flex shrink-0 whitespace-nowrap items-center gap-2 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] rounded-t-sm transition-colors border',
                  moduloActivo === tab.id
                    ? 'border-black/15 border-t-2 border-t-vialto-fire border-b-vialto-mist bg-vialto-mist text-vialto-charcoal'
                    : 'border-transparent text-vialto-steel hover:text-vialto-charcoal hover:bg-black/[0.04]',
                ].join(' ')}
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {moduloActivo === 'financiero' && (
        <FinancieroDashboardSection
          dash={dash}
          showViajes={showViajes}
          showFacturacion={showFacturacionModulo}
          showIntegracionArca={showIntegracionArca}
          onViewViaje={onViewViaje}
          loadingViajeId={loadingViajeId}
        />
      )}

      {moduloActivo === 'stock' && showStock && (
        <section aria-labelledby="stock-heading">
          <h2
            id="stock-heading"
            className="mb-2 font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.2em] text-vialto-steel lg:mb-3"
          >
            Stock
          </h2>
          {dash.loading && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-vialto-steel">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-vialto-steel border-t-transparent" />
              Actualizando…
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <MetricCard
              title="Productos en catálogo"
              tooltip="Productos activos registrados en el catálogo"
              simpleCount={dash.data?.stock?.totalProductos ?? 0}
              loading={dash.loading}
              linkTo="/base-de-datos?tab=productos"
              alwaysLink
            />
            <MetricCard
              title="Clientes"
              tooltip="Clientes registrados"
              simpleCount={dash.data?.stock?.totalClientes ?? 0}
              loading={dash.loading}
              linkTo="/base-de-datos?tab=clientes"
              alwaysLink
            />
            <MetricCard
              title="Ingresos"
              tooltip="Ingresos de mercadería registrados en el período seleccionado"
              simpleCount={dash.data?.stock?.ingresosHoy ?? 0}
              loading={dash.loading}
              valueTone="positiveCash"
              linkTo="/stock/ingresos/historial"
            />
            <MetricCard
              title="Egresos"
              tooltip="Egresos / despachos registrados en el período seleccionado"
              simpleCount={dash.data?.stock?.egresosHoy ?? 0}
              loading={dash.loading}
              valueTone="payable"
              linkTo="/stock/egresos/historial"
            />
          </div>
        </section>
      )}

      {moduloActivo === 'combustible' && showCombustible && (
        <CombustibleDashboardSection tenantId={tenantId} dash={dash} showViajes={showViajes} />
      )}
    </div>
  );
}
