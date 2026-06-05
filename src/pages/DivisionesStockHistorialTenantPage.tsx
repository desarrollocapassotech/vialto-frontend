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
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';

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

      <div className={[listadoTablaWrapperClass, !embeddedInSuperadmin ? 'mt-4' : ''].filter(Boolean).join(' ')}>
        <table className={listadoTablaClass}>
          <thead>
            <tr className={listadoTablaHeadRowClass}>
              <th scope="col" className={listadoTablaThClass}>Fecha</th>
              <th scope="col" className={listadoTablaThClass}>Producto</th>
              <th scope="col" className={listadoTablaThClass}>Cliente</th>
              <th scope="col" className={listadoTablaThClass}>Depósito</th>
              <th scope="col" className={`${listadoTablaThClass} text-right`}>Cant. 1</th>
              <th scope="col" className={`${listadoTablaThClass} text-right`}>Cant. 2</th>
              <th scope="col" className={`${listadoTablaThClass} text-right`}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className={listadoTablaEmptyCellClass}>Cargando…</td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className={listadoTablaEmptyCellClass}>No hay divisiones registradas.</td>
              </tr>
            )}
            {!loading &&
              items.map((m) => (
                <tr key={m.id} className={listadoTablaBodyRowClass}>
                  <td className={`${listadoTablaTdClass} whitespace-nowrap`}>
                    {formatMovimientoStockFechaFromIso(m.fecha)}
                  </td>
                  <td className={listadoTablaTdClass}>{m.producto?.nombre ?? m.productoId}</td>
                  <td className={listadoTablaTdClass}>{m.cliente?.nombre ?? m.clienteId}</td>
                  <td className={listadoTablaTdClass}>{m.deposito?.nombre ?? '—'}</td>
                  <td className={`${listadoTablaTdClass} text-right`}>
                    <span className={m.cantidad1 < 0 ? 'text-red-600' : 'text-emerald-700'}>
                      {m.cantidad1 >= 0 ? '+' : ''}{m.cantidad1}
                    </span>
                    {' '}
                    <span className="text-xs text-vialto-steel">{m.producto?.unidad1Nombre ?? 'Pallets'}</span>
                  </td>
                  <td className={`${listadoTablaTdClass} text-right`}>
                    {m.producto?.unidad2Nombre !== null ? (
                      <>
                        <span className={m.cantidad2 < 0 ? 'text-red-600' : 'text-emerald-700'}>
                          {m.cantidad2 >= 0 ? '+' : ''}{m.cantidad2}
                        </span>
                        {' '}
                        <span className="text-xs text-vialto-steel">{m.producto?.unidad2Nombre ?? 'Unidad'}</span>
                      </>
                    ) : '—'}
                  </td>
                  <td className={`${listadoTablaTdClass} text-right whitespace-nowrap`}>
                    <Link
                      to={`/stock/movimientos/${encodeURIComponent(m.id)}${buildQsTenant(tenantId)}`}
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
