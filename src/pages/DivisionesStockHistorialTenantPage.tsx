import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useState } from "react";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { DivisionImpactoLinea } from "@/components/stock/DivisionImpactoLinea";
import { StockOperacionTipoCelda } from "@/components/stock/StockOperacionTipoCelda";
import { StockOperacionViewModal } from "@/components/stock/StockOperacionViewModal";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useHistorialStockFiltros } from "@/hooks/useHistorialStockFiltros";
import { useBreadcrumbOverride } from "@/hooks/useBreadcrumbOverride";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { buildQs } from "@/lib/queryString";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { formatMovimientoStockFechaFromIso } from "@/lib/viajeFechaHora";
import {
  getDivisionImpacto,
  stockOperacionProductoLabel,
} from "@/lib/stockDivision";
import type {
  StockOperacion,
  Cliente,
  Deposito,
  Producto,
  PaginatedMeta,
} from "@/types/api";

type DivisionesPaginatedResponse = {
  items: StockOperacion[];
  meta: PaginatedMeta;
};

export function DivisionesStockHistorialTenantPage({
  tenantId = "",
  isPlatform = false,
}: {
  tenantId?: string;
  isPlatform?: boolean;
}) {
  const { getToken } = useAuth();

  // Tenant Manager
  const allTenants = useTenantsList({ enabled: isPlatform });
  const tenants = isPlatform ? allTenants : null;
  const [activeTenantId, setActiveTenantId] = useState(tenantId);

  // Mantenemos la constante platform internamente para que la use tu hook de filtros
  const platform = isPlatform;

  const {
    setSearchParams,
    clienteId,
    depositoId,
    productoId,
    fechaDesde,
    fechaHasta,
    params,
    clientes,
    depositos,
    productos,
  } = useHistorialStockFiltros(platform, activeTenantId, getToken);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);

  // Limpiar vista cuando cambia la empresa en modo plataforma
  useEffect(() => {
    setPage(1);
    setItems([]);
    setMeta(null);
    setError(null);
  }, [
    activeTenantId,
    clienteId,
    depositoId,
    productoId,
    fechaDesde,
    fechaHasta,
  ]);

  const divisionesUrl = platform
    ? `/api/platform/stock/divisiones${buildQs(
        { ...params, page: String(page), pageSize: String(pageSize) },
        activeTenantId,
      )}`
    : `/api/stock/divisiones${buildQs({ ...params, page: String(page), pageSize: String(pageSize) })}`;

  const [items, setItems] = useState<StockOperacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viendo, setViendo] = useState<StockOperacion | null>(null);

  const load = useCallback(async () => {
    // Short-circuit: Si es admin y no eligió empresa, limpiamos la vista
    if (isPlatform && !activeTenantId) {
      setItems([]);
      setMeta(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<DivisionesPaginatedResponse>(
        divisionesUrl,
        () => getToken(),
      );
      setItems(data.items);
      setMeta(data.meta);
    } catch (e) {
      setError(friendlyError(e, "stock"));
    } finally {
      setLoading(false);
    }
  }, [divisionesUrl, getToken, isPlatform, activeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const volverHref =
    platform && activeTenantId
      ? `/stock/divisiones?tenantId=${encodeURIComponent(activeTenantId)}`
      : "/stock/divisiones";

  // El tenant seleccionado por el superadmin es estado local (no está en la URL),
  // así que el breadcrumb automático (calculado por ruta) no lo puede reflejar.
  useBreadcrumbOverride([
    { label: platform ? "Panorama" : "Inicio", to: "/" },
    { label: "División de bultos", to: volverHref },
    { label: "Historial de divisiones" },
  ]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-vialto-charcoal">
          Historial de divisiones
        </h1>
      </div>

      {/* Buscador de empresas para plataforma */}
      {isPlatform && (
        <div className="mt-6">
          <EmpresaFilterBar
            tenants={tenants}
            value={activeTenantId}
            onChange={setActiveTenantId}
          />
        </div>
      )}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Estado vacío minimalista igual al de facturación y depósitos */}
      {isPlatform && !activeTenantId && (
        <p className="mt-10 text-sm text-vialto-steel">
          Seleccioná una empresa para ver su historial de divisiones.
        </p>
      )}

      {/* Solo renderizamos el contenido si estamos en modo normal o si ya se seleccionó una empresa */}
      {(!isPlatform || activeTenantId) && (
        <>
          <ListadoDatos
            className="mt-4"
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
                              const next = new URLSearchParams(prev);
                              if (value) next.set("fechaDesde", value);
                              else next.delete("fechaDesde");
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
                              if (value) next.set("fechaHasta", value);
                              else next.delete("fechaHasta");
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
                          const next = new URLSearchParams(prev);
                          if (id) next.set("clienteId", id);
                          else next.delete("clienteId");
                          return next;
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
                          const next = new URLSearchParams(prev);
                          if (id) next.set("depositoId", id);
                          else next.delete("depositoId");
                          return next;
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
                id: "producto",
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
                          if (id) next.set("productoId", id);
                          else next.delete("productoId");
                          return next;
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
                id: "transformacion",
                header: "Transformación",
                thClassName: `${listadoTablaThClass} align-top`,
                cell: (op) => {
                  const impacto = getDivisionImpacto(op);
                  return impacto ? (
                    <DivisionImpactoLinea impacto={impacto} />
                  ) : (
                    "—"
                  );
                },
                tdClassName: listadoTablaTdClass,
              },
              {
                id: "tipo",
                header: "Tipo",
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
              <button
                type="button"
                onClick={() => setViendo(op)}
                className={listadoTablaAccionClass}
              >
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

          {viendo && (
            <StockOperacionViewModal
              operacion={viendo}
              onClose={() => setViendo(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
