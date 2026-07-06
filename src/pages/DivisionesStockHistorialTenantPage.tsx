import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ListadoPagination } from '@/components/listado/ListadoPagination';
import { DivisionImpactoLinea } from '@/components/stock/DivisionImpactoLinea';
import { StockOperacionTipoCelda } from '@/components/stock/StockOperacionTipoCelda';
import { StockOperacionViewModal } from '@/components/stock/StockOperacionViewModal';
import { ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { buildQs } from '@/lib/queryString';
import { listadoTablaAccionClass, listadoTablaTdClass, listadoTablaThClass } from '@/lib/listadoTabla';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import { getDivisionImpacto, stockOperacionProductoLabel } from '@/lib/stockDivision';
import type { StockOperacion, Cliente, Deposito, Producto, PaginatedMeta } from '@/types/api';
import { useHistorialStockFiltros } from '@/hooks/useHistorialStockFiltros';

type DivisionesPaginatedResponse = {
  items: StockOperacion[];
  meta: PaginatedMeta;
};

export function DivisionesStockHistorialTenantPage({
  tenantId,
  embeddedInSuperadmin,
}: {
  tenantId?: string;
  embeddedInSuperadmin?: boolean;
}) {
  const { getToken } = useAuth();
  const platform = Boolean(tenantId);

  const {
    setSearchParams,
    clienteId, depositoId, productoId, fechaDesde, fechaHasta,
    params, clientes, depositos, productos,
  } = useHistorialStockFiltros(platform, tenantId, getToken);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);

  useEffect(() => {
    setPage(1);
  }, [clienteId, depositoId, productoId, fechaDesde, fechaHasta]);

  const divisionesUrl = platform
    ? `/api/platform/stock/divisiones${buildQs(
        { ...params, page: String(page), pageSize: String(pageSize) },
        tenantId,
      )}`
    : `/api/stock/divisiones${buildQs({ ...params, page: String(page), pageSize: String(pageSize) })}`;

  const [items, setItems] = useState<StockOperacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viendo, setViendo] = useState<StockOperacion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<DivisionesPaginatedResponse>(divisionesUrl, () => getToken());
      setItems(data.items);
      setMeta(data.meta);
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
            primary: true,
            thClassName: `${listadoTablaThClass} align-top`,
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
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          if (value) next.set('fechaDesde', value);
                          else next.delete('fechaDesde');
                          return next;
                        });
                      }}
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                    Hasta
                    <input
                      type="date"
                      value={fechaHasta}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSearchParams((prev) => {
                          const next = new URLSearchParams(prev);
                          if (value) next.set('fechaHasta', value);
                          else next.delete('fechaHasta');
                          return next;
                        });
                      }}
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                    />
                  </label>
                </div>
              </ViajesListadoHeaderFiltro>
            ),
            cell: (op) => formatMovimientoStockFechaFromIso(op.fecha),
            tdClassName: `${listadoTablaTdClass} whitespace-nowrap`,
          },
          {
            id: 'cliente',
            thClassName: `${listadoTablaThClass} align-top`,
            header: (
              <ViajesListadoHeaderFiltro
                title="Cliente"
                filterActive={!!clienteId}
                filterSignature={clienteId}
              >
                <SearchableEntitySelect<Cliente>
                  items={clientes}
                  value={clienteId}
                  onChange={(id) => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      if (id) next.set('clienteId', id);
                      else next.delete('clienteId');
                      return next;
                    });
                  }}
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
            cell: (op) => op.cliente?.nombre ?? op.clienteId,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'deposito',
            thClassName: `${listadoTablaThClass} align-top`,
            header: (
              <ViajesListadoHeaderFiltro
                title="Depósito"
                filterActive={!!depositoId}
                filterSignature={depositoId}
              >
                <SearchableEntitySelect<Deposito>
                  items={depositos}
                  value={depositoId}
                  onChange={(id) => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      if (id) next.set('depositoId', id);
                      else next.delete('depositoId');
                      return next;
                    });
                  }}
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
            cell: (op) => op.deposito?.nombre ?? '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'producto',
            thClassName: `${listadoTablaThClass} align-top`,
            header: (
              <ViajesListadoHeaderFiltro
                title="Producto"
                filterActive={!!productoId}
                filterSignature={productoId}
              >
                <SearchableEntitySelect<Producto>
                  items={productos}
                  value={productoId}
                  onChange={(id) => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      if (id) next.set('productoId', id);
                      else next.delete('productoId');
                      return next;
                    });
                  }}
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
            cell: (op) => stockOperacionProductoLabel(op),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'transformacion',
            header: 'Transformación',
            thClassName: `${listadoTablaThClass} align-top`,
            cell: (op) => {
              const impacto = getDivisionImpacto(op);
              return impacto ? <DivisionImpactoLinea impacto={impacto} /> : '—';
            },
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'tipo',
            header: 'Tipo',
            thClassName: `${listadoTablaThClass} align-top`,
            cell: () => <StockOperacionTipoCelda tipo="division" />,
            tdClassName: listadoTablaTdClass,
            showInCard: false,
          },
        ]}
        rows={loading ? null : items}
        rowKey={(op) => op.id}
        emptyMessage="No hay divisiones registradas."
        loadingMessage="Cargando…"
        renderActions={(op) => (
          <button type="button" onClick={() => setViendo(op)} className={listadoTablaAccionClass}>
            Ver
          </button>
        )}
        actionsThClassName={`${listadoTablaThClass} align-top text-right`}
        actionsTdClassName={`${listadoTablaTdClass} text-right whitespace-nowrap`}
      />

      {meta && (
        <ListadoPagination
          meta={meta}
          pageSize={pageSize}
          loading={loading}
          totalLabel="divisiones"
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      )}

      {viendo && <StockOperacionViewModal operacion={viendo} onClose={() => setViendo(null)} />}
    </div>
  );
}
