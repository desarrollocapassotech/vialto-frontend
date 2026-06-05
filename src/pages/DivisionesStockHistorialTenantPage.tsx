import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import type { MovimientoStock } from '@/types/api';

function buildQsTenant(tenantId?: string): string {
  return tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
}

export function DivisionesStockHistorialTenantPage({
  tenantId,
  embeddedInSuperadmin,
}: {
  tenantId?: string;
  embeddedInSuperadmin?: boolean;
}) {
  const { getToken } = useAuth();
  const platform = Boolean(tenantId);
  const divisionesUrl = platform
    ? `/api/platform/stock/divisiones${buildQsTenant(tenantId)}`
    : '/api/stock/divisiones';

  const [items, setItems] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<MovimientoStock[]>(divisionesUrl, () => getToken());
      setItems(data);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    } finally {
      setLoading(false);
    }
  }, [divisionesUrl, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const volverHref = platform
    ? `/stock/divisiones?tenantId=${encodeURIComponent(tenantId!)}`
    : '/stock/divisiones';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {!embeddedInSuperadmin && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Historial de divisiones</h1>
          <Link to={volverHref} className="text-sm font-medium text-vialto-fire hover:underline">
            ← Volver a divisiones
          </Link>
        </div>
      )}

      {embeddedInSuperadmin && (
        <div className="flex justify-end">
          <Link to={volverHref} className="text-sm font-medium text-vialto-fire hover:underline">
            ← Volver a divisiones
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ListadoDatos
        className={!embeddedInSuperadmin ? 'mt-4' : ''}
        columns={[
          {
            id: 'fecha',
            header: 'Fecha',
            primary: true,
            cell: (m) => formatMovimientoStockFechaFromIso(m.fecha),
            tdClassName: `${listadoTablaTdClass} whitespace-nowrap`,
          },
          {
            id: 'producto',
            header: 'Producto',
            cell: (m) => m.producto?.nombre ?? m.productoId,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'cliente',
            header: 'Cliente',
            cell: (m) => m.cliente?.nombre ?? m.clienteId,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'deposito',
            header: 'Depósito',
            cell: (m) => m.deposito?.nombre ?? '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'cant1',
            header: 'Cant. 1',
            cell: (m) => (
              <>
                <span className={m.cantidad1 < 0 ? 'text-red-600' : 'text-emerald-700'}>
                  {m.cantidad1 >= 0 ? '+' : ''}{m.cantidad1}
                </span>
                {' '}
                <span className="text-xs text-vialto-steel">{m.producto?.unidad1Nombre ?? 'Pallets'}</span>
              </>
            ),
            tdClassName: `${listadoTablaTdClass} text-right`,
          },
          {
            id: 'cant2',
            header: 'Cant. 2',
            cell: (m) =>
              m.producto?.unidad2Nombre !== null ? (
                <>
                  <span className={m.cantidad2 < 0 ? 'text-red-600' : 'text-emerald-700'}>
                    {m.cantidad2 >= 0 ? '+' : ''}{m.cantidad2}
                  </span>
                  {' '}
                  <span className="text-xs text-vialto-steel">{m.producto?.unidad2Nombre ?? 'Unidad'}</span>
                </>
              ) : (
                '—'
              ),
            tdClassName: `${listadoTablaTdClass} text-right`,
          },
        ]}
        rows={loading ? null : items}
        rowKey={(m) => m.id}
        emptyMessage="No hay divisiones registradas."
        loadingMessage="Cargando…"
        renderActions={(m) => (
          <Link
            to={`/stock/movimientos/${encodeURIComponent(m.id)}${buildQsTenant(tenantId)}`}
            className={listadoTablaAccionClass}
          >
            Ver
          </Link>
        )}
        actionsTdClassName={`${listadoTablaTdClass} text-right whitespace-nowrap`}
      />
    </div>
  );
}
