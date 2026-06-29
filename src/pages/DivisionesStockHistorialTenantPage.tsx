import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { StockOperacionViewModal } from '@/components/stock/StockOperacionViewModal';
import { ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass, listadoTablaThClass } from '@/lib/listadoTabla';
import {
  coerceMovimientoStockFechaIso,
  formatMovimientoStockFechaFromIso,
  isoToFechaHora,
} from '@/lib/viajeFechaHora';
import type { Cliente, Deposito, Producto, StockOperacion } from '@/types/api';

type ProductosResponse = { items: Producto[] };

function buildQs(params: Record<string, string>, tenantId?: string): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) parts.push(`${k}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

function operacionEnRangoFechas(
  op: StockOperacion,
  fechaDesde: string,
  fechaHasta: string,
): boolean {
  if (!fechaDesde && !fechaHasta) return true;
  const iso = coerceMovimientoStockFechaIso(op.fecha);
  if (!iso) return false;
  const { fecha } = isoToFechaHora(iso);
  if (!fecha) return false;
  if (fechaDesde && fecha < fechaDesde) return false;
  if (fechaHasta && fecha > fechaHasta) return false;
  return true;
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
  const [searchParams, setSearchParams] = useSearchParams();

  const clienteId = searchParams.get('clienteId') ?? '';
  const productoId = searchParams.get('productoId') ?? '';
  const depositoId = searchParams.get('depositoId') ?? '';
  const fechaDesde = searchParams.get('fechaDesde') ?? '';
  const fechaHasta = searchParams.get('fechaHasta') ?? '';

  const apiParams: Record<string, string> = {};
  if (clienteId) apiParams.clienteId = clienteId;
  if (productoId) apiParams.productoId = productoId;
  if (depositoId) apiParams.depositoId = depositoId;

  const divisionesUrl = platform
    ? `/api/platform/stock/divisiones${buildQs(apiParams, tenantId)}`
    : `/api/stock/divisiones${buildQs(apiParams)}`;

  const productosBase = platform ? '/api/platform/stock/productos' : '/api/stock/productos';
  const clientesBase = platform ? '/api/platform/clientes' : '/api/clientes';
  const depositosBase = platform ? '/api/platform/stock/depositos' : '/api/stock/depositos';

  const [items, setItems] = useState<StockOperacion[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
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

  const loadProductos = useCallback(async () => {
    try {
      const url = `${productosBase}/paginated${buildQs(
        { page: '1', pageSize: '100', filtroActivo: 'activos' },
        tenantId,
      )}`;
      const data = await apiJson<ProductosResponse>(url, () => getToken());
      setProductos(data.items);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    }
  }, [productosBase, tenantId, getToken]);

  const loadClientes = useCallback(async () => {
    try {
      const data = await apiJson<Cliente[]>(
        `${clientesBase}${buildQs({}, tenantId)}`,
        () => getToken(),
      );
      setClientes(data);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    }
  }, [clientesBase, tenantId, getToken]);

  const loadDepositos = useCallback(async () => {
    try {
      const data = await apiJson<Deposito[]>(
        `${depositosBase}${buildQs({}, tenantId)}`,
        () => getToken(),
      );
      setDepositos(data);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    }
  }, [depositosBase, tenantId, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadProductos();
  }, [loadProductos]);

  useEffect(() => {
    void loadClientes();
  }, [loadClientes]);

  useEffect(() => {
    void loadDepositos();
  }, [loadDepositos]);

  const filteredItems = useMemo(
    () => items.filter((op) => operacionEnRangoFechas(op, fechaDesde, fechaHasta)),
    [items, fechaDesde, fechaHasta],
  );

  const hasActiveFilters = Boolean(
    clienteId || productoId || depositoId || fechaDesde || fechaHasta,
  );

  const volverHref = platform
    ? `/stock/divisiones?tenantId=${encodeURIComponent(tenantId!)}`
    : '/stock/divisiones';

  function patchSearchParam(key: string, value: string) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (value) params.set(key, value);
      else params.delete(key);
      return params;
    });
  }

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
            header: (
              <ViajesListadoHeaderFiltro
                title="Fecha"
                filterActive={!!fechaDesde || !!fechaHasta}
                filterSignature={`${fechaDesde}|${fechaHasta}`}
              >
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Desde
                    <input
                      type="date"
                      value={fechaDesde}
                      onChange={(e) => patchSearchParam('fechaDesde', e.target.value)}
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Hasta
                    <input
                      type="date"
                      value={fechaHasta}
                      onChange={(e) => patchSearchParam('fechaHasta', e.target.value)}
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                    />
                  </label>
                </div>
              </ViajesListadoHeaderFiltro>
            ),
            primary: true,
            thClassName: `${listadoTablaThClass} align-top`,
            cell: (op) => formatMovimientoStockFechaFromIso(op.fecha),
            tdClassName: `${listadoTablaTdClass} whitespace-nowrap`,
          },
          {
            id: 'cliente',
            header: (
              <ViajesListadoHeaderFiltro
                title="Cliente"
                filterActive={!!clienteId}
                filterSignature={clienteId}
              >
                <SearchableEntitySelect<Cliente>
                  items={clientes}
                  value={clienteId}
                  onChange={(id) => patchSearchParam('clienteId', id)}
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  placeholderCerrado="Todos"
                  placeholderBuscar="Buscar por nombre…"
                  filterItems={(lista, q) => {
                    const lq = q.toLowerCase();
                    return lista.filter((c) => c.nombre.toLowerCase().includes(lq));
                  }}
                  getPrimaryLabel={(c) => c.nombre}
                  searchAriaLabel="Filtrar clientes"
                  aria-label="Filtrar por cliente"
                />
              </ViajesListadoHeaderFiltro>
            ),
            thClassName: `${listadoTablaThClass} align-top`,
            cell: (op) => op.cliente?.nombre ?? op.clienteId,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'deposito',
            header: (
              <ViajesListadoHeaderFiltro
                title="Depósito"
                filterActive={!!depositoId}
                filterSignature={depositoId}
              >
                <SearchableEntitySelect<Deposito>
                  items={depositos}
                  value={depositoId}
                  onChange={(id) => patchSearchParam('depositoId', id)}
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  placeholderCerrado="Todos"
                  placeholderBuscar="Buscar por nombre…"
                  filterItems={(lista, q) => {
                    const lq = q.toLowerCase();
                    return lista.filter((d) => d.nombre.toLowerCase().includes(lq));
                  }}
                  getPrimaryLabel={(d) => d.nombre}
                  searchAriaLabel="Filtrar depósitos"
                  aria-label="Filtrar por depósito"
                />
              </ViajesListadoHeaderFiltro>
            ),
            thClassName: `${listadoTablaThClass} align-top`,
            cell: (op) => op.deposito?.nombre ?? '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'producto',
            header: (
              <ViajesListadoHeaderFiltro
                title="Producto"
                filterActive={!!productoId}
                filterSignature={productoId}
              >
                <SearchableEntitySelect<Producto>
                  items={productos}
                  value={productoId}
                  onChange={(id) => patchSearchParam('productoId', id)}
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  placeholderCerrado="Todos"
                  placeholderBuscar="Buscar por nombre…"
                  filterItems={(lista, q) => {
                    const lq = q.toLowerCase();
                    return lista.filter((p) => p.nombre.toLowerCase().includes(lq));
                  }}
                  getPrimaryLabel={(p) => p.nombre}
                  searchAriaLabel="Filtrar productos"
                  aria-label="Filtrar por producto"
                />
              </ViajesListadoHeaderFiltro>
            ),
            thClassName: `${listadoTablaThClass} align-top`,
            cell: (op) => op.movimientos[0]?.producto?.nombre ?? op.movimientos[0]?.productoId ?? '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'bultos',
            header: 'Bultos',
            thClassName: listadoTablaThClass,
            cell: (op) => {
              const bultos = op.movimientos[0]?.bultos;
              return bultos != null ? String(bultos) : '—';
            },
            tdClassName: `${listadoTablaTdClass} text-right tabular-nums`,
          },
        ]}
        rows={loading ? null : filteredItems}
        rowKey={(op) => op.id}
        emptyMessage={
          hasActiveFilters
            ? 'Sin resultados para los filtros aplicados.'
            : 'No hay divisiones registradas.'
        }
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
