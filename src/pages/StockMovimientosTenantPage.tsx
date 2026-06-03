import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { MovimientoStock } from '@/types/api';
import {
  listadoTablaBodyRowClass,
  listadoTablaClass,
  listadoTablaEmptyCellClass,
  listadoTablaHeadRowClass,
  listadoTablaLinkClass,
  listadoTablaTdClass,
  listadoTablaThClass,
  listadoTablaWrapperClass,
} from '@/lib/listadoTabla';
import {
  movimientoStockTipoBadgeClass,
  movimientoStockTipoLabel,
  movimientoStockTipoNumeroClass,
} from '@/lib/stockMovimientoTipo';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';

function buildQs(params: Record<string, string>, tenantId?: string): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  for (const [k, v] of Object.entries(params)) parts.push(`${k}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function StockMovimientosTenantPage({ tenantId }: { tenantId?: string }) {
  const { getToken } = useAuth();
  const platform = Boolean(tenantId);
  const movimientosUrl = platform
    ? `/api/platform/stock/movimientos${buildQs({ soloIngresoEgreso: 'true' }, tenantId)}`
    : '/api/stock/movimientos?soloIngresoEgreso=true';

  const [items, setItems] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<MovimientoStock[]>(movimientosUrl, () => getToken());
      setItems(data);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    } finally {
      setLoading(false);
    }
  }, [movimientosUrl, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {!platform && (
        <div>
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Movimientos</h1>
          <p className="mt-1 text-sm text-vialto-steel">
            Ingresos y egresos al depósito, ordenados por fecha de movimiento (más reciente primero).
          </p>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className={[listadoTablaWrapperClass, !platform ? 'mt-4' : ''].filter(Boolean).join(' ')}>
        <table className={listadoTablaClass}>
          <thead>
            <tr className={listadoTablaHeadRowClass}>
              <th scope="col" className={listadoTablaThClass}>
                Fecha
              </th>
              <th scope="col" className={listadoTablaThClass}>
                Tipo
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
              <th scope="col" className={`${listadoTablaThClass} text-right`}>
                Pallets
              </th>
              <th scope="col" className={`${listadoTablaThClass} text-right`}>
                Suelto
              </th>
              <th scope="col" className={`${listadoTablaThClass} text-right`}>
                Detalle
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
                  No hay movimientos para mostrar.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((m) => (
                <tr key={m.id} className={listadoTablaBodyRowClass}>
                  <td className={`${listadoTablaTdClass} whitespace-nowrap`}>
                    {formatMovimientoStockFechaFromIso(m.fecha)}
                  </td>
                  <td className={listadoTablaTdClass}>
                    <span className={movimientoStockTipoBadgeClass(m.tipo)}>
                      {movimientoStockTipoLabel(m.tipo)}
                    </span>
                  </td>
                  <td className={`${listadoTablaTdClass} font-mono`}>{m.numeroRemito ?? '—'}</td>
                  <td className={listadoTablaTdClass}>{m.producto?.nombre ?? m.productoId}</td>
                  <td className={listadoTablaTdClass}>{m.cliente?.nombre ?? m.clienteId}</td>
                  <td className={`${listadoTablaTdClass} text-right`}>
                    <span className={movimientoStockTipoNumeroClass(m.tipo)}>{m.cantidadPallets}</span>
                  </td>
                  <td className={`${listadoTablaTdClass} text-right`}>
                    <span className={movimientoStockTipoNumeroClass(m.tipo)}>{m.cantidadSuelto}</span>
                  </td>
                  <td className={`${listadoTablaTdClass} text-right whitespace-nowrap`}>
                    <Link
                      to={`/stock/movimientos/${encodeURIComponent(m.id)}${buildQs({ from: 'movimientos' }, tenantId)}`}
                      className={listadoTablaLinkClass}
                    >
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
