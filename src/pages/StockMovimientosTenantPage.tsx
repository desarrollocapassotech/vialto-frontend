import { useAuth } from "@clerk/clerk-react";
import { FileSpreadsheet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ListadoCard } from "@/components/listado/ListadoCard";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { DivisionImpactoLinea } from "@/components/stock/DivisionImpactoLinea";
import { StockOperacionTipoCelda } from "@/components/stock/StockOperacionTipoCelda";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { ExcelExportModal } from "@/components/stock/ExcelExportModal";
import { ImprimirRemitoButton } from "@/components/stock/ImprimirRemitoButton";
import { StockOperacionViewModal } from "@/components/stock/StockOperacionViewModal";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { paginatedItems } from "@/lib/paginatedItems";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import {
  generarExcel,
  flattenOperacionesMixtas,
  stockOperacionesMixtasColumnas,
} from "@/lib/stockExcelExport";
import {
  getDivisionImpacto,
  stockOperacionLotesLabel,
  stockOperacionProductoLabel,
} from "@/lib/stockDivision";
import { movimientoStockTipoNumeroClass } from "@/lib/stockMovimientoTipo";
import { presentacionNombreFromLike } from "@/lib/stockPresentacion";
import { formatMovimientoStockFechaFromIso } from "@/lib/viajeFechaHora";
import type {
  StockOperacion,
  Producto,
  Cliente,
  Deposito,
  PaginatedMeta,
  PaginatedResponse,
} from "@/types/api";
import { useSearchParams } from "react-router-dom";

type Usuario = {
  id: string;
  nombre: string;
};

type ProductosResponse = {
  items: Producto[];
};

type OperacionesPaginatedResponse = {
  items: StockOperacion[];
  meta: PaginatedMeta;
};

function buildQs(params: Record<string, string>, tenantId?: string): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  for (const [k, v] of Object.entries(params))
    parts.push(`${k}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export function StockMovimientosTenantPage({
  tenantId,
}: {
  tenantId?: string;
}) {
  const { getToken } = useAuth();
  const platform = Boolean(tenantId);

  const [searchParams, setSearchParams] = useSearchParams();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);

  const productoId = searchParams.get("productoId") ?? "";
  const tipo = searchParams.get("tipo") ?? "";
  const fechaDesde = searchParams.get("fechaDesde") ?? "";
  const fechaHasta = searchParams.get("fechaHasta") ?? "";
  const clienteId = searchParams.get("clienteId") ?? "";
  const createdBy = searchParams.get("createdBy") ?? "";
  const depositoId = searchParams.get("depositoId") ?? "";
  const lote = searchParams.get("lote") ?? "";

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);

  const usuariosById = useMemo(
    () => new Map(usuarios.map((u) => [u.id, u])),
    [usuarios],
  );

  // Resetear página al cambiar filtros
  useEffect(() => {
    setPage(1);
  }, [
    productoId,
    tipo,
    fechaDesde,
    fechaHasta,
    clienteId,
    createdBy,
    depositoId,
    lote,
  ]);

  const params: Record<string, string> = {};

  if (tipo) params.tipo = tipo;
  if (fechaDesde) params.fechaDesde = fechaDesde;
  if (fechaHasta) params.fechaHasta = fechaHasta;
  if (productoId) params.productoId = productoId;
  if (clienteId) params.clienteId = clienteId;
  if (createdBy) params.createdBy = createdBy;
  if (depositoId) params.depositoId = depositoId;
  if (lote) params.lote = lote;

  params.page = String(page);
  params.pageSize = String(pageSize);

  const productosBase = platform
    ? "/api/platform/stock/productos"
    : "/api/stock/productos";

  const clientesBase = platform ? "/api/platform/clientes" : "/api/clientes";

  const usuariosBase = platform ? "/api/platform/users" : "/api/users";

  const operacionesUrl = platform
    ? `/api/platform/stock/operaciones/paginated${buildQs(params, tenantId)}`
    : `/api/stock/movimientos${buildQs(params)}`;

  const depositosBase = platform
    ? "/api/platform/stock/depositos"
    : "/api/stock/depositos";

  const [items, setItems] = useState<StockOperacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viendoOperacion, setViendoOperacion] = useState<StockOperacion | null>(
    null,
  );
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const excelRows = flattenOperacionesMixtas(items);
  const excelCols = stockOperacionesMixtasColumnas();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<OperacionesPaginatedResponse>(
        operacionesUrl,
        () => getToken(),
      );
      setItems(data.items);
      setMeta(data.meta);
    } catch (e) {
      setError(friendlyError(e, "stock"));
    } finally {
      setLoading(false);
    }
  }, [operacionesUrl, getToken]);

  const loadProductos = useCallback(async () => {
    try {
      const url = `${productosBase}/paginated${buildQs(
        {
          page: "1",
          pageSize: "100",
          filtroActivo: "activos",
        },
        tenantId,
      )}`;

      const data = await apiJson<ProductosResponse>(url, () => getToken());

      setProductos(data.items);
    } catch (e) {
      setError(friendlyError(e, "stock"));
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
      setError(friendlyError(e, "stock"));
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
          nombre: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
        })),
      );
    } catch (e) {
      setError(friendlyError(e, "stock"));
    }
  }, [usuariosBase, tenantId, getToken]);

  const loadDepositos = useCallback(async () => {
    try {
      const data = await apiJson<PaginatedResponse<Deposito>>(
        `${depositosBase}${buildQs({ page: "1", pageSize: "500" }, tenantId)}`,
        () => getToken(),
      );

      setDepositos(paginatedItems(data));
    } catch (e) {
      setError(friendlyError(e, "stock"));
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
            <h1 className="text-2xl font-semibold text-vialto-charcoal">
              Movimientos
            </h1>
            <p className="mt-1 text-sm text-vialto-steel">
              Ingresos, egresos y divisiones consolidados por comprobante (una
              fila por operación).
            </p>
          </div>
          {exportExcelButton}
        </div>
      ) : (
        <div className="flex justify-end">{exportExcelButton}</div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {lote && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-black/10 bg-vialto-mist/50 px-4 py-3 text-sm text-vialto-charcoal">
          <p>
            Filtrado por lote:{" "}
            <span className="font-medium">
              {lote === "__sin_lote__" ? "Sin lote" : lote}
            </span>
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("lote");
                return next;
              });
            }}
            className="text-xs uppercase tracking-wider text-vialto-fire hover:underline"
          >
            Quitar filtro
          </button>
        </div>
      )}

      <ListadoDatos
        className={!platform ? "mt-4" : ""}
        columns={[
          {
            id: "fecha",
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

                          if (value) params.set("fechaDesde", value);
                          else params.delete("fechaDesde");

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
                            params.set("fechaHasta", e.target.value);
                          } else {
                            params.delete("fechaHasta");
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
            cell: (op) => formatMovimientoStockFechaFromIso(op.fecha),
          },
          {
            id: "tipo",
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

                      if (value) params.set("tipo", value);
                      else params.delete("tipo");

                      return params;
                    });
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    tipo ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                >
                  <option value="">Todos</option>
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                  <option value="division">División</option>
                </select>
              </ViajesListadoHeaderFiltro>
            ),
            cell: (op) => <StockOperacionTipoCelda tipo={op.tipo} />,
          },
          {
            id: "impacto",
            thClassName: `${listadoTablaThClass} align-top`,
            header: "Impacto",
            cell: (op) => {
              if (op.tipo === "division") {
                const impacto = getDivisionImpacto(op);
                return impacto ? <DivisionImpactoLinea impacto={impacto} /> : "—";
              }
              const totalBultos = op.movimientos.reduce((s, m) => s + m.bultos, 0);
              const totalUnidades = op.movimientos.reduce(
                (s, m) => s + m.unidades,
                0,
              );
              if (totalBultos === 0 && totalUnidades === 0) return "—";
              const ref = op.movimientos[0];
              const u1 = presentacionNombreFromLike(ref?.presentacion) || "Bultos";
              const u2 = "Sueltas";
              const sign = op.tipo === "egreso" ? "−" : "+";
              return (
                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  {totalBultos > 0 && (
                    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
                      <span className={movimientoStockTipoNumeroClass(op.tipo)}>
                        {sign}
                        {totalBultos}
                      </span>
                      <span className="text-xs font-normal text-vialto-steel">
                        {u1}
                      </span>
                    </span>
                  )}
                  {totalUnidades > 0 && (
                    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
                      <span className={movimientoStockTipoNumeroClass(op.tipo)}>
                        {sign}
                        {totalUnidades}
                      </span>
                      <span className="text-xs font-normal text-vialto-steel">
                        {u2}
                      </span>
                    </span>
                  )}
                </span>
              );
            },
            tdClassName: listadoTablaTdClass,
          },
          {
            id: "remito",
            thClassName: `${listadoTablaThClass} align-top`,
            header: "Remito",
            cell: (op) => op.numeroRemito ?? "—",
            tdClassName: `${listadoTablaTdClass} font-mono`,
          },
          {
            id: "producto",
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
                      const params = new URLSearchParams(prev);

                      if (id) params.set("productoId", id);
                      else params.delete("productoId");

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
            cell: (op) => stockOperacionProductoLabel(op),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: "cliente",
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

                      if (id) params.set("clienteId", id);
                      else params.delete("clienteId");

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
            cell: (op) => op.cliente?.nombre ?? op.clienteId,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: "deposito",
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

                      if (id) params.set("depositoId", id);
                      else params.delete("depositoId");

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
            cell: (op) => op.deposito?.nombre ?? "—",
            tdClassName: listadoTablaTdClass,
          },
          {
            id: "lotes",
            thClassName: `${listadoTablaThClass} align-top`,
            header: "Lotes",
            cell: (op) => stockOperacionLotesLabel(op),
            tdClassName: `${listadoTablaTdClass} text-xs`,
          },
          {
            id: "usuario",
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

                      if (id) params.set("createdBy", id);
                      else params.delete("createdBy");

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
            cell: (op) =>
              usuariosById.get(op.createdBy)?.nombre ?? op.createdBy ?? "—",
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={loading ? null : items}
        rowKey={(op) => op.id}
        emptyMessage="No hay movimientos para mostrar."
        loadingMessage="Cargando…"
        renderMobileCard={(op) => {
          const impacto =
            op.tipo === "division" ? getDivisionImpacto(op) : null;
          return (
            <ListadoCard
              primary={
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{formatMovimientoStockFechaFromIso(op.fecha)}</span>
                  <StockOperacionTipoCelda tipo={op.tipo} />
                </div>
              }
              fields={[
                ...(impacto
                  ? [
                      {
                        label: "Transformación",
                        value: <DivisionImpactoLinea impacto={impacto} />,
                      },
                    ]
                  : []),
                {
                  label: "Producto",
                  value: stockOperacionProductoLabel(op),
                },
                {
                  label: "Cliente",
                  value: op.cliente?.nombre ?? op.clienteId,
                },
                {
                  label: "Depósito",
                  value: op.deposito?.nombre ?? "—",
                },
                ...(op.numeroRemito
                  ? [{ label: "Remito", value: op.numeroRemito }]
                  : []),
              ]}
              actions={
                <div className="flex flex-wrap justify-end gap-2">
                  {op.tipo === "egreso" && (
                    <ImprimirRemitoButton
                      variant="listado"
                      className={listadoTablaAccionClass}
                      egresoId={op.id}
                      tenantId={tenantId}
                      titulo={
                        op.numeroRemito
                          ? `Remito ${op.numeroRemito}`
                          : "Remito interno"
                      }
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setViendoOperacion(op)}
                    className={listadoTablaAccionClass}
                  >
                    Ver
                  </button>
                </div>
              }
            />
          );
        }}
        renderActions={(op) => (
          <div className="flex flex-wrap justify-end gap-2">
            {op.tipo === "egreso" && (
              <ImprimirRemitoButton
                variant="listado"
                className={listadoTablaAccionClass}
                egresoId={op.id}
                tenantId={tenantId}
                titulo={
                  op.numeroRemito ? `Remito ${op.numeroRemito}` : "Remito interno"
                }
              />
            )}
            <button
              type="button"
              onClick={() => setViendoOperacion(op)}
              className={listadoTablaAccionClass}
            >
              Ver
            </button>
          </div>
        )}
        actionsThClassName={`${listadoTablaThClass} align-top text-right`}
        actionsTdClassName={`${listadoTablaTdClass} text-right whitespace-nowrap`}
      />

      {meta && (
        <ListadoPagination
          meta={meta}
          pageSize={pageSize}
          onPageChange={(newPage) => {
            setPage(newPage);
          }}
          onPageSizeChange={(newPageSize) => {
            setPageSize(newPageSize);
            setPage(1);
          }}
        />
      )}

      {viendoOperacion && (
        <StockOperacionViewModal
          operacion={viendoOperacion}
          tenantId={tenantId}
          onClose={() => setViendoOperacion(null)}
        />
      )}

      {exportModalOpen && (
        <ExcelExportModal
          columns={excelCols}
          rowCount={excelRows.length}
          onExport={(selectedIds) => {
            const cols = excelCols.filter((c) => selectedIds.includes(c.id));
            generarExcel(cols, excelRows, "movimientos-stock");
          }}
          onClose={() => setExportModalOpen(false)}
        />
      )}
    </div>
  );
}
