import { useAuth } from '@clerk/clerk-react';
import { ChevronDown, FileSpreadsheet, Warehouse } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { ListadoCard } from '@/components/listado/ListadoCard';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ListadoFiltroCampo } from '@/components/listado/ListadoFiltroCampo';
import { ExcelExportModal } from '@/components/stock/ExcelExportModal';
import {
  SelectorOpcionesSheet,
  selectorTriggerClass,
  type SelectorOpcion,
} from '@/components/ui/SelectorOpcionesSheet';
import { ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { generarExcel, stockItemColumnas } from '@/lib/stockExcelExport';
import type { Cliente, Deposito, StockItem } from '@/types/api';

type ProductoFiltro = { id: string; nombre: string };
import {
  listadoTablaBodyRowClass,
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from '@/lib/listadoTabla';

function buildQs(tenantId?: string) {
  return tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
}

function cantidad1Cell(item: StockItem) {
  return (
    <>
      <span className={item.cantidad1 === 0 ? 'text-vialto-steel' : 'font-semibold text-vialto-charcoal'}>
        {item.cantidad1}
      </span>
      {' '}
      <span className="text-xs text-vialto-steel">
        {item.producto?.unidad1Nombre ?? 'Pallets'}
      </span>
    </>
  );
}

function cantidad2Cell(item: StockItem) {
  if (item.producto?.unidad2Nombre === null) {
    return <span className="text-vialto-steel">—</span>;
  }
  return (
    <>
      <span className={item.cantidad2 === 0 ? 'text-vialto-steel' : 'font-semibold text-vialto-charcoal'}>
        {item.cantidad2}
      </span>
      {' '}
      <span className="text-xs text-vialto-steel">
        {item.producto?.unidad2Nombre ?? 'Unidad'}
      </span>
    </>
  );
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
  const [depositoSheetOpen, setDepositoSheetOpen] = useState(false);
  const [filtroClienteId, setFiltroClienteId] = useState('');
  const [filtroProductoId, setFiltroProductoId] = useState('');
  const [soloConStockCant1, setSoloConStockCant1] = useState(false);
  const [soloConStockCant2, setSoloConStockCant2] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);

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
    setDepositoSheetOpen(false);
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
    const map = new Map<string, ProductoFiltro>();
    for (const item of items) {
      if (item.depositoId !== depositoActivoId || !item.producto) continue;
      if (!map.has(item.producto.id)) {
        map.set(item.producto.id, {
          id: item.producto.id,
          nombre: item.producto.nombre,
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

  const depositoActivo = depositos.find((d) => d.id === depositoActivoId);
  const depositoActivoCount = depositoActivoId ? (countByDeposito[depositoActivoId] ?? 0) : 0;

  const depositoOptions: SelectorOpcion[] = depositos.map((dep) => {
    const count = countByDeposito[dep.id] ?? 0;
    return {
      id: dep.id,
      label: dep.nombre,
      trailing: (
        <span className="rounded-full bg-black/8 px-1.5 py-0.5 text-xs font-semibold leading-none text-vialto-steel">
          {count}
        </span>
      ),
    };
  });

  // Mostrar columna 2 si algún producto del tab activo tiene unidad2Nombre
  const showUnidad2 = useMemo(
    () => items.some((i) => i.depositoId === depositoActivoId && i.producto?.unidad2Nombre !== null),
    [items, depositoActivoId],
  );

  const colSpan = 2 + 1 + (showUnidad2 ? 1 : 0); // cliente + producto + cant1 [+ cant2]

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filtroClienteId.trim()) n += 1;
    if (filtroProductoId.trim()) n += 1;
    if (soloConStockCant1) n += 1;
    if (soloConStockCant2) n += 1;
    return n;
  }, [filtroClienteId, filtroProductoId, soloConStockCant1, soloConStockCant2]);

  function limpiarFiltros() {
    setFiltroClienteId('');
    setFiltroProductoId('');
    setSoloConStockCant1(false);
    setSoloConStockCant2(false);
  }

  const stockEmptyMessage =
    filtroClienteId || filtroProductoId || soloConStockCant1 || soloConStockCant2
      ? 'Sin resultados para los filtros aplicados.'
      : 'Sin stock registrado en este depósito.';

  const filterToolbar = (
    <>
      <ListadoFiltroCampo label="Cliente" active={!!filtroClienteId.trim()}>
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
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Producto" active={!!filtroProductoId.trim()}>
        <SearchableEntitySelect<ProductoFiltro>
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
          searchAriaLabel="Filtrar productos"
          aria-label="Filtrar por producto"
          inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
            filtroProductoId.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'
          }`}
        />
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Cant. 1" active={soloConStockCant1}>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-vialto-charcoal">
          <input
            type="checkbox"
            checked={soloConStockCant1}
            onChange={(e) => setSoloConStockCant1(e.target.checked)}
            className="h-4 w-4 accent-vialto-charcoal"
          />
          Solo con stock
        </label>
      </ListadoFiltroCampo>
      {showUnidad2 && (
        <ListadoFiltroCampo label="Cant. 2" active={soloConStockCant2}>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-vialto-charcoal">
            <input
              type="checkbox"
              checked={soloConStockCant2}
              onChange={(e) => setSoloConStockCant2(e.target.checked)}
              className="h-4 w-4 accent-vialto-charcoal"
            />
            Solo con stock
          </label>
        </ListadoFiltroCampo>
      )}
    </>
  );

  return (
    <div className="w-full space-y-6">
      {!platform && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-vialto-charcoal">Inventario</h1>
            <p className="mt-1 text-sm text-vialto-steel">
              Stock disponible en cada depósito, en tiempo real.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={filteredItems.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider border border-black/20 px-3 py-2 hover:bg-vialto-mist disabled:opacity-40"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            Descargar Excel
          </button>
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
          {/* Selector mobile / tabs desktop por depósito */}
          <div className="border-b border-black/10">
            <div className="pb-3 lg:hidden">
              <button
                type="button"
                onClick={() => setDepositoSheetOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={depositoSheetOpen}
                className={selectorTriggerClass}
              >
                <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                  Depósito
                </span>
                <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <Warehouse className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={1.75} aria-hidden />
                  <span className="truncate font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-vialto-charcoal">
                    {depositoActivo?.nombre ?? 'Depósito'}
                  </span>
                  <span className="shrink-0 rounded-full bg-vialto-fire/15 px-1.5 py-0.5 text-xs font-semibold leading-none text-vialto-fire">
                    {depositoActivoCount}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={2} aria-hidden />
                </span>
              </button>
              <SelectorOpcionesSheet
                open={depositoSheetOpen}
                onClose={() => setDepositoSheetOpen(false)}
                title="Elegir depósito"
                options={depositoOptions}
                activeId={depositoActivoId}
                onSelect={handleCambiarTab}
              />
            </div>

            <nav className="-mb-px hidden flex-wrap gap-0 lg:flex" aria-label="Depósitos">
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
            </nav>
          </div>

          <ListadoDatos
            columns={[]}
            rows={filteredItems}
            rowKey={(item) => item.id}
            emptyMessage={stockEmptyMessage}
            tableColSpan={colSpan}
            filters={filterToolbar}
            activeFilterCount={activeFilterCount}
            onClearFilters={limpiarFiltros}
            tableHead={
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
                    <SearchableEntitySelect<ProductoFiltro>
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
            }
            renderTableRow={(item) => {
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
                    {cantidad1Cell(item)}
                  </td>
                  {showUnidad2 && (
                    <td className={`${listadoTablaTdClass} text-right tabular-nums`}>
                      {cantidad2Cell(item)}
                    </td>
                  )}
                </tr>
              );
            }}
            renderMobileCard={(item) => {
              const sinStock = item.cantidad1 === 0 && item.cantidad2 === 0;
              const clienteNombre = item.cliente?.nombre ?? item.clienteId;
              const productoNombre = item.producto?.nombre ?? item.productoId;
              const fields = [
                {
                  label: 'Producto',
                  value: <span className={sinStock ? 'text-vialto-steel' : ''}>{productoNombre}</span>,
                },
                {
                  label: 'Cant. 1',
                  value: cantidad1Cell(item),
                },
              ];
              if (showUnidad2) {
                fields.push({ label: 'Cant. 2', value: cantidad2Cell(item) });
              }
              return (
                <ListadoCard
                  primary={<span className={sinStock ? 'text-vialto-steel' : ''}>{clienteNombre}</span>}
                  fields={fields}
                />
              );
            }}
          />
        </>
      )}

      {exportModalOpen && (
        <ExcelExportModal
          columns={stockItemColumnas(filteredItems)}
          rowCount={filteredItems.length}
          onExport={(selectedIds) => {
            const allCols = stockItemColumnas(filteredItems);
            const cols = allCols.filter((c) => selectedIds.includes(c.id));
            const deposito = depositoActivo?.nombre ?? 'inventario';
            generarExcel(cols, filteredItems, `inventario-${deposito}`);
          }}
          onClose={() => setExportModalOpen(false)}
        />
      )}
    </div>
  );
}
