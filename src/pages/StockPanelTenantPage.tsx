import { useAuth } from '@clerk/clerk-react';
import { Warehouse } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Cliente, Deposito, Producto, StockItem } from '@/types/api';
import {
  listadoTablaBodyRowClass,
  listadoTablaClass,
  listadoTablaEmptyCellClass,
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
  listadoTablaWrapperClass,
} from '@/lib/listadoTabla';

function buildQs(tenantId?: string) {
  return tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
}

export function StockPanelTenantPage({ tenantId }: { tenantId?: string }) {
  const { getToken } = useAuth();
  const platform = Boolean(tenantId);
  const disponibleUrl = platform
    ? `/api/platform/stock/disponible${buildQs(tenantId)}`
    : '/api/stock/disponible';
  const depositosUrl = platform
    ? `/api/platform/stock/depositos${buildQs(tenantId)}`
    : '/api/stock/depositos';

  const [items, setItems] = useState<StockItem[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [depositoActivoId, setDepositoActivoId] = useState<string | null>(null);
  const [filtroClienteId, setFiltroClienteId] = useState('');
  const [filtroProductoId, setFiltroProductoId] = useState('');
  const [soloConStockCant1, setSoloConStockCant1] = useState(false);
  const [soloConStockCant2, setSoloConStockCant2] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stockData, depositosData] = await Promise.all([
        apiJson<StockItem[]>(disponibleUrl, () => getToken()),
        apiJson<Deposito[]>(depositosUrl, () => getToken()),
      ]);
      setItems(stockData);
      setDepositos(depositosData.filter((d) => d.activo));
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    } finally {
      setLoading(false);
    }
  }, [disponibleUrl, depositosUrl, getToken]);

  useEffect(() => {
    void load();
  }, [load]);

  // Seleccionar primer depósito si no hay uno activo o si el activo ya no existe
  useEffect(() => {
    if (depositos.length > 0 && (depositoActivoId === null || !depositos.find((d) => d.id === depositoActivoId))) {
      setDepositoActivoId(depositos[0].id);
    }
  }, [depositos, depositoActivoId]);

  const handleCambiarTab = (id: string) => {
    setDepositoActivoId(id);
    setFiltroClienteId('');
    setFiltroProductoId('');
    setSoloConStockCant1(false);
    setSoloConStockCant2(false);
  };

  const clientesEnDeposito = useMemo(() => {
    if (!depositoActivoId) return [];
    const map = new Map<string, Cliente>();
    for (const item of items) {
      if (item.depositoId !== depositoActivoId || !item.cliente) continue;
      if (!map.has(item.cliente.id)) {
        map.set(item.cliente.id, {
          id: item.cliente.id,
          tenantId: item.tenantId,
          nombre: item.cliente.nombre,
          idFiscal: null,
          email: null,
          telefono: null,
          direccion: null,
          pais: null,
          condicionIva: null,
          condicionTributaria: null,
          createdAt: '',
        });
      }
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [items, depositoActivoId]);

  const productosEnDeposito = useMemo(() => {
    if (!depositoActivoId) return [];
    const map = new Map<string, Producto>();
    for (const item of items) {
      if (item.depositoId !== depositoActivoId || !item.producto) continue;
      if (!map.has(item.producto.id)) {
        map.set(item.producto.id, {
          id: item.producto.id,
          tenantId: item.tenantId,
          nombre: item.producto.nombre,
          codigo: null,
          descripcion: null,
          unidadMedida: item.producto.unidadMedida ?? null,
          unidad1Nombre: item.producto.unidad1Nombre,
          unidad2Nombre: item.producto.unidad2Nombre,
          activo: true,
          createdAt: '',
          updatedAt: '',
        });
      }
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [items, depositoActivoId]);

  const filteredItems = useMemo(() => {
    if (!depositoActivoId) return [];
    return items.filter((item) => {
      if (item.depositoId !== depositoActivoId) return false;
      if (filtroClienteId && item.clienteId !== filtroClienteId) return false;
      if (filtroProductoId && item.productoId !== filtroProductoId) return false;
      if (soloConStockCant1 && item.cantidad1 === 0) return false;
      if (
        soloConStockCant2 &&
        item.producto?.unidad2Nombre !== null &&
        item.cantidad2 === 0
      ) {
        return false;
      }
      return true;
    });
  }, [items, depositoActivoId, filtroClienteId, filtroProductoId, soloConStockCant1, soloConStockCant2]);

  const countByDeposito = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) {
      map[item.depositoId] = (map[item.depositoId] ?? 0) + 1;
    }
    return map;
  }, [items]);

  // Mostrar columna 2 si algún producto del tab activo tiene unidad2Nombre
  const showUnidad2 = useMemo(
    () => items.some((i) => i.depositoId === depositoActivoId && i.producto?.unidad2Nombre !== null),
    [items, depositoActivoId],
  );

  const colSpan = 2 + 1 + (showUnidad2 ? 1 : 0); // cliente + producto + cant1 [+ cant2]

  const anyFiltroActivo = useMemo(
    () =>
      Boolean(filtroClienteId.trim()) ||
      Boolean(filtroProductoId.trim()) ||
      soloConStockCant1 ||
      soloConStockCant2,
    [filtroClienteId, filtroProductoId, soloConStockCant1, soloConStockCant2],
  );

  function limpiarFiltros() {
    setFiltroClienteId('');
    setFiltroProductoId('');
    setSoloConStockCant1(false);
    setSoloConStockCant2(false);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {!platform && (
        <div>
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Inventario</h1>
          <p className="mt-1 text-sm text-vialto-steel">
            Stock disponible en cada depósito, en tiempo real.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading && (
        <p className="text-sm text-vialto-steel">Cargando…</p>
      )}

      {!loading && depositos.length === 0 && (
        <p className="text-sm text-vialto-steel">No hay depósitos activos configurados.</p>
      )}

      {!loading && depositos.length > 0 && (
        <>
          {/* Tabs por depósito */}
          <div className="flex flex-wrap gap-0 border-b border-black/10">
            {depositos.map((dep) => {
              const activo = depositoActivoId === dep.id;
              const count = countByDeposito[dep.id] ?? 0;
              return (
                <button
                  key={dep.id}
                  type="button"
                  onClick={() => handleCambiarTab(dep.id)}
                  className={[
                    'flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                    activo
                      ? 'border-vialto-fire text-vialto-charcoal'
                      : 'border-transparent text-vialto-steel hover:text-vialto-charcoal hover:border-black/20',
                  ].join(' ')}
                >
                  <Warehouse className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {dep.nombre}
                  <span
                    className={[
                      'rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none',
                      activo
                        ? 'bg-vialto-fire/15 text-vialto-fire'
                        : 'bg-black/8 text-vialto-steel',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {anyFiltroActivo && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={limpiarFiltros}
                className="inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
              >
                Limpiar filtros
              </button>
            </div>
          )}

          <div className={listadoTablaWrapperClass}>
            <table className={`${listadoTablaClass} table-fixed`}>
              <colgroup>
                <col />
                <col />
                <col className="w-36" />
                {showUnidad2 && <col className="w-36" />}
              </colgroup>
              <thead>
                <tr className={listadoTablaHeadRowClass}>
                  <th scope="col" className={`${listadoTablaThClass} align-top`}>
                    <ViajesListadoHeaderFiltro
                      title="Cliente"
                      filterActive={!!filtroClienteId.trim()}
                      filterSignature={filtroClienteId}
                    >
                      <ClienteSearchSelect
                        id="stock-panel-filtro-cliente"
                        clientes={clientesEnDeposito}
                        value={filtroClienteId}
                        onChange={setFiltroClienteId}
                        allowEmptyValue
                        emptyListChoiceLabel="Todos"
                        placeholderCerrado="Todos"
                        placeholderBuscar="Buscar por nombre…"
                        aria-label="Filtrar por cliente"
                        inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                          filtroClienteId.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'
                        }`}
                      />
                    </ViajesListadoHeaderFiltro>
                  </th>
                  <th scope="col" className={`${listadoTablaThClass} align-top`}>
                    <ViajesListadoHeaderFiltro
                      title="Producto"
                      filterActive={!!filtroProductoId.trim()}
                      filterSignature={filtroProductoId}
                    >
                      <SearchableEntitySelect<Producto>
                        items={productosEnDeposito}
                        value={filtroProductoId}
                        onChange={setFiltroProductoId}
                        allowEmptyValue
                        emptyListChoiceLabel="Todos"
                        placeholderCerrado="Todos"
                        placeholderBuscar="Buscar por nombre…"
                        filterItems={(lista, q) => {
                          const lq = q.toLowerCase();
                          return lista.filter((p) => p.nombre.toLowerCase().includes(lq));
                        }}
                        getPrimaryLabel={(p) => p.nombre}
                        getSecondaryLabel={(p) => p.unidadMedida ?? undefined}
                        searchAriaLabel="Filtrar productos"
                        aria-label="Filtrar por producto"
                        inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                          filtroProductoId.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'
                        }`}
                      />
                    </ViajesListadoHeaderFiltro>
                  </th>
                  <th scope="col" className={`${listadoTablaThClass} text-right align-top`}>
                    <ViajesListadoHeaderFiltro
                      title="Cant. 1"
                      alignRight
                      filterActive={soloConStockCant1}
                      filterSignature={soloConStockCant1 ? '1' : ''}
                    >
                      <label className="flex cursor-pointer items-center justify-end gap-2 text-sm text-vialto-charcoal">
                        <input
                          type="checkbox"
                          checked={soloConStockCant1}
                          onChange={(e) => setSoloConStockCant1(e.target.checked)}
                          className="h-4 w-4 accent-vialto-charcoal"
                        />
                        Solo con stock
                      </label>
                    </ViajesListadoHeaderFiltro>
                  </th>
                  {showUnidad2 && (
                    <th scope="col" className={`${listadoTablaThClass} text-right align-top`}>
                      <ViajesListadoHeaderFiltro
                        title="Cant. 2"
                        alignRight
                        filterActive={soloConStockCant2}
                        filterSignature={soloConStockCant2 ? '1' : ''}
                      >
                        <label className="flex cursor-pointer items-center justify-end gap-2 text-sm text-vialto-charcoal">
                          <input
                            type="checkbox"
                            checked={soloConStockCant2}
                            onChange={(e) => setSoloConStockCant2(e.target.checked)}
                            className="h-4 w-4 accent-vialto-charcoal"
                          />
                          Solo con stock
                        </label>
                      </ViajesListadoHeaderFiltro>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className={listadoTablaEmptyCellClass}>
                      {filtroClienteId || filtroProductoId || soloConStockCant1 || soloConStockCant2
                        ? 'Sin resultados para los filtros aplicados.'
                        : 'Sin stock registrado en este depósito.'}
                    </td>
                  </tr>
                )}
                {filteredItems.map((item) => {
                  const sinStock = item.cantidad1 === 0 && item.cantidad2 === 0;
                  return (
                    <tr key={item.id} className={listadoTablaBodyRowClass}>
                      <td className={listadoTablaTdClass}>
                        <span className={sinStock ? 'text-vialto-steel' : ''}>
                          {item.cliente?.nombre ?? item.clienteId}
                        </span>
                      </td>
                      <td className={listadoTablaTdClass}>
                        <span className={sinStock ? 'text-vialto-steel' : ''}>
                          {item.producto?.nombre ?? item.productoId}
                        </span>
                      </td>
                      <td className={`${listadoTablaTdClass} text-right tabular-nums`}>
                        <span className={item.cantidad1 === 0 ? 'text-vialto-steel' : 'font-semibold text-vialto-charcoal'}>
                          {item.cantidad1}
                        </span>
                        {' '}
                        <span className="text-xs text-vialto-steel">
                          {item.producto?.unidad1Nombre ?? 'Pallets'}
                        </span>
                      </td>
                      {showUnidad2 && (
                        <td className={`${listadoTablaTdClass} text-right tabular-nums`}>
                          {item.producto?.unidad2Nombre !== null ? (
                            <>
                              <span className={item.cantidad2 === 0 ? 'text-vialto-steel' : 'font-semibold text-vialto-charcoal'}>
                                {item.cantidad2}
                              </span>
                              {' '}
                              <span className="text-xs text-vialto-steel">
                                {item.producto?.unidad2Nombre ?? 'Unidad'}
                              </span>
                            </>
                          ) : (
                            <span className="text-vialto-steel">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
