import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MovimientoStockViewModal } from '@/components/stock/MovimientoStockViewModal';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { MovimientoStock } from '@/types/api';
import {
  listadoTablaBodyRowClass,
  listadoTablaClass,
  listadoTablaEmptyCellClass,
  listadoTablaHeadRowClass,
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaThClass,
  listadoTablaWrapperClass,
} from '@/lib/listadoTabla';
import { movimientoStockTipoNumeroClass } from '@/lib/stockMovimientoTipo';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';

function buildQsTenant(tenantId?: string): string {
  return tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
}

export function EgresosStockHistorialTenantPage({
  tenantId,
  embeddedInSuperadmin,
}: {
  tenantId?: string;
  embeddedInSuperadmin?: boolean;
}) {
  const { getToken } = useAuth();
  const platform = Boolean(tenantId);
  const egresosUrl = platform
    ? `/api/platform/stock/egresos${buildQsTenant(tenantId)}`
    : '/api/stock/egresos';

  const [items, setItems] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalleMovimientoId, setDetalleMovimientoId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<MovimientoStock[]>(egresosUrl, () => getToken());
      setItems(data);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    } finally {
      setLoading(false);
    }
  }, [egresosUrl, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const volverHref = platform
    ? `/stock/egresos?tenantId=${encodeURIComponent(tenantId!)}`
    : '/stock/egresos';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {!embeddedInSuperadmin && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Historial de egresos</h1>
          <Link
            to={volverHref}
            className="text-sm font-medium text-vialto-fire hover:underline"
          >
            ← Volver a egresos
          </Link>
        </div>
      )}

      {embeddedInSuperadmin && (
        <div className="flex justify-end">
          <Link
            to={volverHref}
            className="text-sm font-medium text-vialto-fire hover:underline"
          >
            ← Volver a egresos
          </Link>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        className={[listadoTablaWrapperClass, !embeddedInSuperadmin ? 'mt-4' : '']
          .filter(Boolean)
          .join(' ')}
      >
        <table className={listadoTablaClass}>
          <thead>
            <tr className={listadoTablaHeadRowClass}>
              <th scope="col" className={listadoTablaThClass}>
                Fecha
              </th>
              <th scope="col" className={listadoTablaThClass}>
                Remito
              </th>
              <th scope="col" className={listadoTablaThClass}>
                Producto
              </th>
              <th scope="col" className={listadoTablaThClass}>
                Cliente
              </th>
              <th scope="col" className={listadoTablaThClass}>
                Depósito
              </th>
              <th scope="col" className={`${listadoTablaThClass} text-right`}>
                Cant. 1
              </th>
              <th scope="col" className={`${listadoTablaThClass} text-right`}>
                Cant. 2
              </th>
              <th scope="col" className={`${listadoTablaThClass} text-right`}>
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className={listadoTablaEmptyCellClass}>
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className={listadoTablaEmptyCellClass}>
                  No hay egresos registrados.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((m) => (
                <tr key={m.id} className={listadoTablaBodyRowClass}>
                  <td className={`${listadoTablaTdClass} whitespace-nowrap`}>
                    {formatMovimientoStockFechaFromIso(m.fecha)}
                  </td>
                  <td className={`${listadoTablaTdClass} font-mono`}>{m.numeroRemito ?? '—'}</td>
                  <td className={listadoTablaTdClass}>{m.producto?.nombre ?? m.productoId}</td>
                  <td className={listadoTablaTdClass}>{m.cliente?.nombre ?? m.clienteId}</td>
                  <td className={listadoTablaTdClass}>{m.deposito?.nombre ?? '—'}</td>
                  <td className={`${listadoTablaTdClass} text-right`}>
                    <span className={movimientoStockTipoNumeroClass(m.tipo)}>{m.cantidad1}</span>
                    {' '}
                    <span className="text-xs text-vialto-steel">{m.producto?.unidad1Nombre ?? 'Pallets'}</span>
                  </td>
                  <td className={`${listadoTablaTdClass} text-right`}>
                    {m.producto?.unidad2Nombre !== null ? (
                      <>
                        <span className={movimientoStockTipoNumeroClass(m.tipo)}>{m.cantidad2}</span>
                        {' '}
                        <span className="text-xs text-vialto-steel">{m.producto?.unidad2Nombre ?? 'Unidad'}</span>
                      </>
                    ) : '—'}
                  </td>
                  <td className={`${listadoTablaTdClass} text-right whitespace-nowrap`}>
                    <button
                      type="button"
                      onClick={() => setDetalleMovimientoId(m.id)}
                      className={listadoTablaAccionClass}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {detalleMovimientoId && (
        <MovimientoStockViewModal
          movimientoId={detalleMovimientoId}
          tenantId={tenantId}
          tipoTitulo="egreso"
          onClose={() => setDetalleMovimientoId(null)}
        />
      )}
    </div>
  );
}
