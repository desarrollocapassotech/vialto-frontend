import { useAuth } from '@clerk/clerk-react';
import { FileSpreadsheet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ExcelExportModal } from '@/components/stock/ExcelExportModal';
import { ImprimirRemitoButton } from '@/components/stock/ImprimirRemitoButton';
import { MovimientoStockViewModal } from '@/components/stock/MovimientoStockViewModal';
import { ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { listadoTablaAccionClass, listadoTablaTdClass, listadoTablaThClass } from '@/lib/listadoTabla';
import { generarExcel, movimientoStockColumnas } from '@/lib/stockExcelExport';
import {
  movimientoStockTipoBadgeClass,
  movimientoStockTipoLabel,
  movimientoStockTipoNumeroClass,
} from '@/lib/stockMovimientoTipo';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import type { MovimientoStock, Producto, Cliente, Deposito } from '@/types/api';
import { useSearchParams } from 'react-router-dom';

type Usuario = {
  id: string;
  nombre: string;
};

type ProductosResponse = {
  items: Producto[];
};

function buildQs(params: Record<string, string>, tenantId?: string): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  for (const [k, v] of Object.entries(params)) parts.push(`${k}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function StockMovimientosTenantPage({ tenantId }: { tenantId?: string }) {
  const { getToken } = useAuth();
  const platform = Boolean(tenantId);

  const [searchParams, setSearchParams] = useSearchParams();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);

  const productoId = searchParams.get('productoId') ?? '';
  const tipo = searchParams.get('tipo') ?? '';
  const fechaDesde = searchParams.get('fechaDesde') ?? '';
  const fechaHasta = searchParams.get('fechaHasta') ?? '';
  const clienteId = searchParams.get('clienteId') ?? '';
  const createdBy = searchParams.get('createdBy') ?? '';
  const depositoId = searchParams.get('depositoId') ?? '';

  const params: Record<string, string> = {};

  if (tipo) params.tipo = tipo;
  if (fechaDesde) params.fechaDesde = fechaDesde;
  if (fechaHasta) params.fechaHasta = fechaHasta;
  if (productoId) params.productoId = productoId;
  if (clienteId) params.clienteId = clienteId;
  if (createdBy) params.createdBy = createdBy;
  if (depositoId) params.depositoId = depositoId;

  const productosBase = platform
    ? '/api/platform/stock/productos'
    : '/api/stock/productos';

  const clientesBase = platform
    ? '/api/platform/clientes'
    : '/api/clientes';

  const usuariosBase = platform
    ? '/api/platform/users'
    : '/api/users';

  const movimientosUrl = platform
    ? `/api/platform/stock/movimientos${buildQs(params, tenantId)}`
    : `/api/stock/movimientos${buildQs(params)}`;

  const depositosBase = platform
    ? '/api/platform/stock/depositos'
    : '/api/stock/depositos';

  const [items, setItems] = useState<MovimientoStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detalleMovimientoId, setDetalleMovimientoId] = useState<string | null>(null);
  const [detalleMovimientoTipo, setDetalleMovimientoTipo] = useState<MovimientoStock['tipo'] | undefined>();
  const [exportModalOpen, setExportModalOpen] = useState(false);

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

  const loadProductos = useCallback(async () => {
    try {
      const url =
        `${productosBase}/paginated${buildQs(
          {
            page: '1',
            pageSize: '100',
            filtroActivo: 'activos',
          },
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

  const loadUsuarios = useCallback(async () => {
    try {
      const data = await apiJson<any[]>(
        `${usuariosBase}${buildQs({}, tenantId)}`,
        () => getToken(),
      );

      setUsuarios(
        data.map((u) => ({
          id: u.userId,
          nombre: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        })),
      );
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    }
  }, [usuariosBase, tenantId, getToken]);

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
    void loadUsuarios();
  }, [loadUsuarios]);

  useEffect(() => {
    void loadDepositos();
  }, [loadDepositos]);

  const exportExcelButton = (
    <button
      type="button"
      onClick={() => setExportModalOpen(true)}
      disabled={items.length === 0}
      className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider border border-black/20 px-3 py-2 hover:bg-vialto-mist disabled:opacity-40"
    >
      <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
      Descargar Excel
    </button>
  );

  return (
    <div className="w-full space-y-6">
      {!platform ? (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-vialto-charcoal">Movimientos</h1>
            <p className="mt-1 text-sm text-vialto-steel">
              Ingresos y egresos al depósito, ordenados por fecha de movimiento (más reciente primero).
            </p>
          </div>
          {exportExcelButton}
        </div>
      ) : (
        <div className="flex justify-end">{exportExcelButton}</div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <ListadoDatos
        className={!platform ? 'mt-4' : ''}
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
                          const params = new URLSearchParams(prev);

                          if (value) params.set('fechaDesde', value);
                          else params.delete('fechaDesde');

                          return params;
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
                        setSearchParams((prev) => {
                          const params = new URLSearchParams(prev);

                          if (e.target.value) {
                            params.set('fechaHasta', e.target.value);
                          } else {
                            params.delete('fechaHasta');
                          }

                          return params;
                        });
                      }}
                      className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                    />
                  </label>
                </div>
              </ViajesListadoHeaderFiltro>
            ),
            cell: (m) => formatMovimientoStockFechaFromIso(m.fecha),
          },
          {
            id: 'tipo',
            thClassName: `${listadoTablaThClass} align-top`,
            header: (
              <ViajesListadoHeaderFiltro
                title="Tipo"
                filterActive={!!tipo}
                filterSignature={tipo}
              >
                <select
                  value={tipo}
                  onChange={(e) => {
                    const value = e.target.value;

                    setSearchParams((prev) => {
                      const params = new URLSearchParams(prev);

                      if (value) params.set('tipo', value);
                      else params.delete('tipo');

                      return params;
                    });
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    tipo ? 'text-vialto-fire' : 'text-vialto-charcoal'
                  }`}
                >
                  <option value="">Todos</option>
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                  <option value="division">División</option>
                </select>
              </ViajesListadoHeaderFiltro>
            ),
            cell: (m) => (
              <span className={movimientoStockTipoBadgeClass(m.tipo)}>
                {movimientoStockTipoLabel(m.tipo)}
              </span>
            ),
          },
          {
            id: 'remito',
            thClassName: `${listadoTablaThClass} align-top`,
            header: 'Remito',
            cell: (m) => m.numeroRemito ?? '—',
            tdClassName: `${listadoTablaTdClass} font-mono`,
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
                      const params = new URLSearchParams(prev);

                      if (id) params.set('productoId', id);
                      else params.delete('productoId');

                      return params;
                    });
                  }}
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  placeholderCerrado="Todos"
                  placeholderBuscar="Buscar por nombre…"
                  filterItems={(lista, q) => {
                    const lq = q.toLowerCase();
                    return lista.filter((p) =>
                      p.nombre.toLowerCase().includes(lq),
                    );
                  }}
                  getPrimaryLabel={(p) => p.nombre}
                  searchAriaLabel="Filtrar productos"
                  aria-label="Filtrar por producto"
                />
              </ViajesListadoHeaderFiltro>
            ),
            cell: (m) => m.producto?.nombre ?? m.productoId,
            tdClassName: listadoTablaTdClass,
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
                      const params = new URLSearchParams(prev);

                      if (id) params.set('clienteId', id);
                      else params.delete('clienteId');

                      return params;
                    });
                  }}
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  placeholderCerrado="Todos"
                  placeholderBuscar="Buscar por nombre…"
                  filterItems={(lista, q) => {
                    const lq = q.toLowerCase();
                    return lista.filter((c) =>
                      c.nombre.toLowerCase().includes(lq),
                    );
                  }}
                  getPrimaryLabel={(c) => c.nombre}
                  searchAriaLabel="Filtrar clientes"
                  aria-label="Filtrar por cliente"
                />
              </ViajesListadoHeaderFiltro>
            ),
            cell: (m) => m.cliente?.nombre ?? m.clienteId,
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
                      const params = new URLSearchParams(prev);

                      if (id) params.set('depositoId', id);
                      else params.delete('depositoId');

                      return params;
                    });
                  }}
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  placeholderCerrado="Todos"
                  placeholderBuscar="Buscar por nombre…"
                  filterItems={(lista, q) => {
                    const lq = q.toLowerCase();
                    return lista.filter((d) =>
                      d.nombre.toLowerCase().includes(lq),
                    );
                  }}
                  getPrimaryLabel={(d) => d.nombre}
                  searchAriaLabel="Filtrar depósitos"
                  aria-label="Filtrar por depósito"
                />
              </ViajesListadoHeaderFiltro>
            ),
            cell: (m) => m.deposito?.nombre ?? '—',
            tdClassName: listadoTablaTdClass,
          },
          {
            id: 'cant1',
            thClassName: `${listadoTablaThClass} align-top`,
            header: 'Cant. 1',
            cell: (m) => (
              <>
                <span className={movimientoStockTipoNumeroClass(m.tipo)}>{m.cantidad1}</span>
                {' '}
                <span className="text-xs text-vialto-steel">{m.producto?.unidad1Nombre ?? 'Pallets'}</span>
              </>
            ),
            tdClassName: `${listadoTablaTdClass} text-right`,
          },
          {
            id: 'cant2',
            thClassName: `${listadoTablaThClass} align-top`,
            header: 'Cant. 2',
            cell: (m) =>
              m.producto?.unidad2Nombre !== null ? (
                <>
                  <span className={movimientoStockTipoNumeroClass(m.tipo)}>{m.cantidad2}</span>
                  {' '}
                  <span className="text-xs text-vialto-steel">{m.producto?.unidad2Nombre ?? 'Unidad'}</span>
                </>
              ) : (
                '—'
              ),
            tdClassName: `${listadoTablaTdClass} text-right`,
          },
          {
            id: 'usuario',
            thClassName: `${listadoTablaThClass} align-top`,
            header: (
              <ViajesListadoHeaderFiltro
                title="Usuario"
                filterActive={!!createdBy}
                filterSignature={createdBy}
              >
                <SearchableEntitySelect<Usuario>
                  items={usuarios}
                  value={createdBy}
                  onChange={(id) => {
                    setSearchParams((prev) => {
                      const params = new URLSearchParams(prev);

                      if (id) params.set('createdBy', id);
                      else params.delete('createdBy');

                      return params;
                    });
                  }}
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  placeholderCerrado="Todos"
                  placeholderBuscar="Buscar usuario..."
                  filterItems={(lista, q) => {
                    const lq = q.toLowerCase();

                    return lista.filter((u) =>
                      u.nombre.toLowerCase().includes(lq),
                    );
                  }}
                  getPrimaryLabel={(u) => u.nombre}
                  searchAriaLabel="Filtrar usuarios"
                  aria-label="Filtrar por usuario"
                />
              </ViajesListadoHeaderFiltro>
            ),
            cell: (m) => m.createdByLabel ?? '—',
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={loading ? null : items}
        rowKey={(m) => m.id}
        emptyMessage="No hay movimientos para mostrar."
        loadingMessage="Cargando…"
        renderActions={(m) => (
          <div className="flex flex-wrap justify-end gap-2">
            {m.tipo === 'egreso' && (
              <ImprimirRemitoButton
                variant="listado"
                className={listadoTablaAccionClass}
                egresoId={m.operacionId}
                tenantId={tenantId}
                titulo={m.numeroRemito ? `Remito ${m.numeroRemito}` : 'Remito interno'}
              />
            )}
            <button
              type="button"
              onClick={() => {
                setDetalleMovimientoId(m.id);
                setDetalleMovimientoTipo(m.tipo);
              }}
              className={listadoTablaAccionClass}
            >
              Ver
            </button>
          </div>
        )}
        actionsThClassName={`${listadoTablaThClass} align-top text-right`}
        actionsTdClassName={`${listadoTablaTdClass} text-right whitespace-nowrap`}
      />

      {detalleMovimientoId && (
        <MovimientoStockViewModal
          movimientoId={detalleMovimientoId}
          tenantId={tenantId}
          tipoTitulo={detalleMovimientoTipo}
          onClose={() => {
            setDetalleMovimientoId(null);
            setDetalleMovimientoTipo(undefined);
          }}
        />
      )}

      {exportModalOpen && (
        <ExcelExportModal
          columns={movimientoStockColumnas(items, productos)}
          rowCount={items.length}
          onExport={(selectedIds) => {
            const allCols = movimientoStockColumnas(items, productos);
            const cols = allCols.filter((c) => selectedIds.includes(c.id));
            generarExcel(cols, items, 'movimientos-stock');
          }}
          onClose={() => setExportModalOpen(false)}
        />
      )}
    </div>
  );
}
