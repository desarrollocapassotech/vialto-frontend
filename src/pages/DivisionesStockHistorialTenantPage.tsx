import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { StockOperacionViewModal } from '@/components/stock/StockOperacionViewModal';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass } from '@/lib/listadoTabla';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import type { StockOperacion } from '@/types/api';

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

  const [items, setItems] = useState<StockOperacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viendo, setViendo] = useState<StockOperacion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<StockOperacion[]>(divisionesUrl, () => getToken());
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
    <div className="w-full space-y-6">
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
            cell: (op) => formatMovimientoStockFechaFromIso(op.fecha),
            tdClassName: `${listadoTablaTdClass} whitespace-nowrap`,
          },
          {
            id: 'cliente',
            header: 'Cliente',
            cell: (op) => op.cliente?.nombre ?? op.clienteId,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'deposito',
            header: 'Depósito',
            cell: (op) => op.deposito?.nombre ?? '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'producto',
            header: 'Producto',
            cell: (op) => op.movimientos[0]?.producto?.nombre ?? op.movimientos[0]?.productoId ?? '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'bultos',
            header: 'Bultos',
            cell: (op) => {
              const bultos = op.movimientos[0]?.bultos;
              return bultos != null ? String(bultos) : '—';
            },
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
        ]}
        rows={loading ? null : items}
        rowKey={(op) => op.id}
        emptyMessage="No hay divisiones registradas."
        loadingMessage="Cargando…"
        renderActions={(op) => (
          <button
            type="button"
            onClick={() => setViendo(op)}
            className={listadoTablaAccionClass}
          >
            Ver
          </button>
        )}
        actionsTdClassName={`${listadoTablaTdClass} text-right whitespace-nowrap`}
      />

      {viendo && (
        <StockOperacionViewModal
          operacion={viendo}
          onClose={() => setViendo(null)}
        />
      )}
    </div>
  );
}
