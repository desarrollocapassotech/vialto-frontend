import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { formatInstantEsAr24h, formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import {
  movimientoStockTipoBadgeClass,
  movimientoStockTipoLabel,
  movimientoStockTipoNumeroClass,
} from '@/lib/stockMovimientoTipo';
import type { MovimientoStock } from '@/types/api';

export function MovimientoStockDetallePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const tenantIdParam = searchParams.get('tenantId');
  const fromMovimientosList = searchParams.get('from') === 'movimientos';
  const { getToken } = useAuth();
  const { user, isLoaded } = useUser();
  const superadmin = isLoaded && isPlatformSuperadmin(user?.publicMetadata);

  const [row, setRow] = useState<MovimientoStock | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsTenant = superadmin && !tenantIdParam;
  const url =
    superadmin && tenantIdParam
      ? `/api/platform/stock/movimientos/${encodeURIComponent(id ?? '')}?tenantId=${encodeURIComponent(tenantIdParam)}`
      : `/api/stock/movimientos/${encodeURIComponent(id ?? '')}`;

  useEffect(() => {
    if (!id || needsTenant) return;
    void (async () => {
      setError(null);
      try {
        const data = await apiJson<MovimientoStock>(url, () => getToken());
        setRow(data);
      } catch (e) {
        setError(friendlyError(e, 'stock'));
        setRow(null);
      }
    })();
  }, [id, url, getToken, needsTenant]);

  if (!id) {
    return <p className="text-sm text-vialto-steel">Movimiento no especificado.</p>;
  }

  if (needsTenant) {
    return (
      <div className="max-w-lg space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Para ver un movimiento como administrador de plataforma, abrilo desde el historial de egresos de la empresa (el enlace incluye la empresa).</p>
        <Link to="/stock/egresos" className="text-vialto-fire font-medium hover:underline">
          Ir a egresos
        </Link>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!row) {
    return <p className="text-vialto-steel py-8 text-center">Cargando…</p>;
  }

  const volverMovimientosHref = (() => {
    const q = new URLSearchParams();
    if (tenantIdParam?.trim()) q.set('tenantId', tenantIdParam.trim());
    const s = q.toString();
    return `/stock/movimientos${s ? `?${s}` : ''}`;
  })();

  const volverHref = fromMovimientosList
    ? volverMovimientosHref
    : row.tipo === 'egreso'
      ? '/stock/egresos'
      : '/stock/ingresos';
  const volverLabel = fromMovimientosList
    ? 'Volver a movimientos'
    : row.tipo === 'egreso'
      ? 'Volver a egresos'
      : 'Volver a ingresos';

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Movimiento de stock</h1>
          <p className="mt-1">
            <span className={movimientoStockTipoBadgeClass(row.tipo)}>
              {movimientoStockTipoLabel(row.tipo)}
            </span>
          </p>
        </div>
        <Link to={volverHref} className="text-sm text-vialto-fire hover:underline shrink-0">
          {volverLabel}
        </Link>
      </div>

      <dl className="rounded-lg border border-black/10 bg-white divide-y divide-black/5 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Número de remito
          </dt>
          <dd className="sm:col-span-2 font-mono text-vialto-charcoal">{row.numeroRemito ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Fecha movimiento
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">
            {formatMovimientoStockFechaFromIso(row.fecha, { alwaysShowTime: true })}
          </dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Producto
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">{row.producto?.nombre ?? row.productoId}</dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Empresa / Cliente
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">{row.cliente?.nombre ?? row.clienteId}</dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Pallets
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">
            <span className={movimientoStockTipoNumeroClass(row.tipo)}>{row.cantidadPallets}</span>
          </dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Suelto
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">
            <span className={movimientoStockTipoNumeroClass(row.tipo)}>{row.cantidadSuelto}</span>
          </dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Observaciones
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal whitespace-pre-wrap">{row.observaciones ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Remito escaneado
          </dt>
          <dd className="sm:col-span-2 break-all">
            {row.remitoUrl ? (
              <a href={row.remitoUrl} className="text-vialto-fire hover:underline" target="_blank" rel="noreferrer">
                {row.remitoUrl}
              </a>
            ) : (
              <span className="text-vialto-steel">Sin adjunto</span>
            )}
          </dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Registrado por
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">
            {row.createdByLabel ? (
              <span title={row.createdBy ? `ID: ${row.createdBy}` : undefined}>{row.createdByLabel}</span>
            ) : row.createdBy ? (
              <span className="text-vialto-steel" title={row.createdBy}>
                Usuario no disponible
              </span>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 px-4 py-3">
          <dt className="text-vialto-steel font-[family-name:var(--font-ui)] uppercase text-xs tracking-wide">
            Fecha y hora de registro
          </dt>
          <dd className="sm:col-span-2 text-vialto-charcoal">{formatInstantEsAr24h(row.createdAt)}</dd>
        </div>
      </dl>
    </div>
  );
}
