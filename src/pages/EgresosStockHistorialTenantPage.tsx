import { useAuth } from '@clerk/clerk-react';
import { FileSpreadsheet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ExcelExportModal } from '@/components/stock/ExcelExportModal';
import { ImprimirRemitoButton } from '@/components/stock/ImprimirRemitoButton';
import { StockOperacionViewModal } from '@/components/stock/StockOperacionViewModal';
import { ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { buildQs } from '@/lib/queryString';
import { listadoTablaAccionClass, listadoTablaTdClass, listadoTablaThClass } from '@/lib/listadoTabla';
import {
  flattenStockOperaciones,
  stockOperacionColumnas,
} from '@/lib/stockExcelExport';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import type { StockOperacion, Cliente, Deposito, Producto } from '@/types/api';
import { useHistorialStockFiltros } from '@/hooks/useHistorialStockFiltros';

export function EgresosStockHistorialTenantPage({
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

  const egresosUrl = platform
    ? `/api/platform/stock/egresos${buildQs(params, tenantId)}`
    : `/api/stock/egresos${buildQs(params)}`;

  const [items, setItems] = useState<StockOperacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viendo, setViendo] = useState<StockOperacion | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<StockOperacion[]>(egresosUrl, () => getToken());
      setItems(data);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    } finally {
      setLoading(false);
    }
  }, [egresosUrl, getToken]);

  useEffect(() => { void load(); }, [load]);

  const volverHref = platform
    ? `/stock/egresos?tenantId=${encodeURIComponent(tenantId!)}`
    : '/stock/egresos';

  const excelCols = stockOperacionColumnas('egreso');
  const excelRows = flattenStockOperaciones(items);

  return (
    <div className="w-full space-y-6">
      {!embeddedInSuperadmin && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Historial de egresos</h1>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              disabled={excelRows.length === 0}
              className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider border border-black/20 px-3 py-2 hover:bg-vialto-mist disabled:opacity-40"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
              Descargar Excel
            </button>
            <Link to={volverHref} className="text-sm font-medium text-vialto-fire hover:underline">
              ← Volver a egresos
            </Link>
          </div>
        </div>
      )}

      {embeddedInSuperadmin && (
        <div className="flex flex-wrap items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={excelRows.length === 0}
            className="text-xs font-medium uppercase tracking-wider border border-black/20 px-3 py-2 hover:bg-vialto-mist disabled:opacity-40"
          >
            Descargar Excel
          </button>
          <Link to={volverHref} className="text-sm font-medium text-vialto-fire hover:underline">
            ← Volver a egresos
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
          },
          {
            id: 'remito',
            thClassName: `${listadoTablaThClass} align-top`,
            header: 'Remito',
            cell: (op) => op.numeroRemito ?? '—',
            tdClassName: `${listadoTablaTdClass} font-mono`,
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
            id: 'destinatario',
            thClassName: `${listadoTablaThClass} align-top`,
            header: 'Destinatario',
            cell: (op) => op.destinatario ?? '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'productos',
            thClassName: `${listadoTablaThClass} align-top`,
            header: (
              <ViajesListadoHeaderFiltro
                title="Productos"
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
            cell: (op) => {
              const count = op.movimientos.length;
              if (count === 1) {
                return op.movimientos[0].producto?.nombre ?? '1 producto';
              }
              return `${count} productos`;
            },
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={loading ? null : items}
        rowKey={(op) => op.id}
        emptyMessage="No hay egresos registrados."
        loadingMessage="Cargando…"
        renderActions={(op) => (
          <div className="flex flex-wrap justify-end gap-2">
            <ImprimirRemitoButton
              variant="listado"
              className={listadoTablaAccionClass}
              egresoId={op.id}
              tenantId={tenantId}
              titulo={op.numeroRemito ? `Remito ${op.numeroRemito}` : 'Remito interno'}
            />
            <button
              type="button"
              onClick={() => setViendo(op)}
              className={listadoTablaAccionClass}
            >
              Ver
            </button>
          </div>
        )}
        actionsThClassName={`${listadoTablaThClass} align-top text-right`}
        actionsTdClassName={`${listadoTablaTdClass} text-right whitespace-nowrap`}
      />

      {viendo && (
        <StockOperacionViewModal
          operacion={viendo}
          tenantId={tenantId}
          onClose={() => setViendo(null)}
        />
      )}

      {exportModalOpen && (
        <ExcelExportModal
          columns={excelCols}
          rowCount={excelRows.length}
          onExport={(selectedIds) => {
            const cols = excelCols.filter((c) => selectedIds.includes(c.id));
            void generarExcel(cols, excelRows, 'historial-egresos');
          }}
          onClose={() => setExportModalOpen(false)}
        />
      )}
    </div>
  );
}

async function generarExcel<T>(
  cols: import('@/lib/stockExcelExport').ExcelColDef<T>[],
  rows: T[],
  filename: string,
) {
  const { generarExcel: gen } = await import('@/lib/stockExcelExport');
  return gen(cols, rows, filename);
}
