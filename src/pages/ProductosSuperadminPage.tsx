import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { useTenantsList } from "@/hooks/useTenantsList";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import type { Producto, PaginatedMeta } from "@/types/api";
import { ProductoModal } from "@/components/stock/ProductoModal";
import { ListadoFiltroCampo } from "@/components/listado/ListadoFiltroCampo";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";

type Paginated = { items: Producto[]; meta: PaginatedMeta };

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "view"; producto: Producto }
  | { mode: "edit"; producto: Producto };

export function ProductosSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const tenants = useTenantsList();

  const [filtroEmpresa, setFiltroEmpresa] = useState("");
  const [rows, setRows] = useState<Producto[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [codigoFiltroInput, setCodigoFiltroInput] = useState("");
  const [codigoFiltro, setCodigoFiltro] = useState("");
  const [nombreFiltroInput, setNombreFiltroInput] = useState("");
  const [nombreFiltro, setNombreFiltro] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<
    "todos" | "activos" | "inactivos"
  >("todos");
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !filtroEmpresa) return;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      filtroActivo,
      tenantId: filtroEmpresa,
    });
    if (codigoFiltro) params.set("codigo", codigoFiltro);
    if (nombreFiltro) params.set("q", nombreFiltro);
    const data = await apiJson<Paginated>(
      `/api/platform/stock/productos/paginated?${params.toString()}`,
      () => getToken(),
    );
    setRows(data.items);
    setMeta(data.meta);
  }, [
    getToken,
    isLoaded,
    isSignedIn,
    filtroEmpresa,
    page,
    pageSize,
    codigoFiltro,
    nombreFiltro,
    filtroActivo,
  ]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setRows(null);
      setMeta(null);
      setError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await load();
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setMeta(null);
          setError(friendlyError(e, "plataforma"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, load, filtroEmpresa]);

  useEffect(() => {
    setPage(1);
  }, [codigoFiltro, nombreFiltro, filtroActivo, filtroEmpresa]);

  async function toggleActivo(row: Producto) {
    const mensaje = row.activo
      ? `¿Desactivar "${row.nombre}"? Los movimientos históricos conservan el vínculo.`
      : `¿Reactivar "${row.nombre}"?`;
    if (!window.confirm(mensaje)) return;
    setError(null);
    try {
      await apiJson<Producto>(
        `/api/platform/stock/productos/${encodeURIComponent(row.id)}?tenantId=${encodeURIComponent(filtroEmpresa)}`,
        () => getToken(),
        { method: "PATCH", body: JSON.stringify({ activo: !row.activo }) },
      );
      await load();
    } catch (e) {
      setError(friendlyError(e, "plataforma"));
    }
  }

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (codigoFiltro.trim()) n += 1;
    if (nombreFiltro.trim()) n += 1;
    if (filtroActivo !== "todos") n += 1;
    return n;
  }, [codigoFiltro, nombreFiltro, filtroActivo]);

  function limpiarFiltros() {
    setCodigoFiltroInput("");
    setCodigoFiltro("");
    setNombreFiltroInput("");
    setNombreFiltro("");
    setFiltroActivo("todos");
  }

  const productosListadoFiltros = (
    <>
      <ListadoFiltroCampo label="Código" active={!!codigoFiltro.trim()}>
        <div className="flex gap-1">
          <input
            type="text"
            value={codigoFiltroInput}
            onChange={(e) => setCodigoFiltroInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setCodigoFiltro(codigoFiltroInput.trim());
            }}
            placeholder="Buscar…"
            className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 font-mono text-sm ${
              codigoFiltro.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
            }`}
            aria-label="Filtrar por código de producto"
          />
          <button
            type="button"
            onClick={() => setCodigoFiltro(codigoFiltroInput.trim())}
            className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
          >
            OK
          </button>
        </div>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Nombre" active={!!nombreFiltro.trim()}>
        <div className="flex gap-1">
          <input
            type="text"
            value={nombreFiltroInput}
            onChange={(e) => setNombreFiltroInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setNombreFiltro(nombreFiltroInput.trim());
            }}
            placeholder="Buscar…"
            className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
              nombreFiltro.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
            }`}
            aria-label="Filtrar por nombre de producto"
          />
          <button
            type="button"
            onClick={() => setNombreFiltro(nombreFiltroInput.trim())}
            className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
          >
            OK
          </button>
        </div>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Estado" active={filtroActivo !== "todos"}>
        <select
          value={filtroActivo}
          onChange={(e) =>
            setFiltroActivo(e.target.value as "todos" | "activos" | "inactivos")
          }
          className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
            filtroActivo !== "todos"
              ? "text-vialto-fire"
              : "text-vialto-charcoal"
          }`}
          aria-label="Filtrar por estado del producto"
        >
          <option value="todos">Todos</option>
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo inactivos</option>
        </select>
      </ListadoFiltroCampo>
    </>
  );

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Productos
      </h1>
      <p className="mt-2 text-vialto-steel max-w-2xl">
        Catálogo de productos por empresa. Elegí una empresa para gestionar su
        catálogo.
      </p>

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={(v) => {
            setFiltroEmpresa(v);
            setModal({ mode: "closed" });
          }}
        />
      </div>

      {filtroEmpresa && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setModal({ mode: "create" })}
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
            >
              Nuevo producto
            </button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <ListadoDatos
            className="mt-4"
            filters={productosListadoFiltros}
            activeFilterCount={activeFilterCount}
            onClearFilters={limpiarFiltros}
            tableHead={
              <tr className={listadoTablaHeadRowClass}>
                <th scope="col" className={`${listadoTablaThClass} align-top`}>
                  <ViajesListadoHeaderFiltro
                    title="Código"
                    filterActive={!!codigoFiltro.trim()}
                    filterSignature={codigoFiltro}
                  >
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={codigoFiltroInput}
                        onChange={(e) => setCodigoFiltroInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            setCodigoFiltro(codigoFiltroInput.trim());
                        }}
                        placeholder="Buscar…"
                        className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 font-mono text-sm ${
                          codigoFiltro.trim()
                            ? "text-vialto-fire"
                            : "text-vialto-charcoal"
                        }`}
                        aria-label="Filtrar por código de producto"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCodigoFiltro(codigoFiltroInput.trim())
                        }
                        className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                      >
                        OK
                      </button>
                    </div>
                  </ViajesListadoHeaderFiltro>
                </th>
                <th scope="col" className={`${listadoTablaThClass} align-top`}>
                  <ViajesListadoHeaderFiltro
                    title="Nombre"
                    filterActive={!!nombreFiltro.trim()}
                    filterSignature={nombreFiltro}
                  >
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={nombreFiltroInput}
                        onChange={(e) => setNombreFiltroInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            setNombreFiltro(nombreFiltroInput.trim());
                        }}
                        placeholder="Buscar…"
                        className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
                          nombreFiltro.trim()
                            ? "text-vialto-fire"
                            : "text-vialto-charcoal"
                        }`}
                        aria-label="Filtrar por nombre de producto"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setNombreFiltro(nombreFiltroInput.trim())
                        }
                        className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                      >
                        OK
                      </button>
                    </div>
                  </ViajesListadoHeaderFiltro>
                </th>
                <th scope="col" className={`${listadoTablaThClass} align-top`}>
                  <ViajesListadoHeaderFiltro
                    title="Estado"
                    filterActive={filtroActivo !== "todos"}
                    filterSignature={filtroActivo}
                  >
                    <select
                      value={filtroActivo}
                      onChange={(e) =>
                        setFiltroActivo(
                          e.target.value as "todos" | "activos" | "inactivos",
                        )
                      }
                      className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                        filtroActivo !== "todos"
                          ? "text-vialto-fire"
                          : "text-vialto-charcoal"
                      }`}
                      aria-label="Filtrar por estado del producto"
                    >
                      <option value="todos">Todos</option>
                      <option value="activos">Solo activos</option>
                      <option value="inactivos">Solo inactivos</option>
                    </select>
                  </ViajesListadoHeaderFiltro>
                </th>
                <th
                  scope="col"
                  className={`${listadoTablaThClass} text-right align-top`}
                >
                  Acciones
                </th>
              </tr>
            }
            columns={[
              {
                id: "codigo",
                header: "Código",
                cell: (r) => r.codigo ?? "—",
                tdClassName: `${listadoTablaTdClass} font-mono text-sm text-vialto-steel`,
              },
              {
                id: "nombre",
                header: "Nombre",
                primary: true,
                cell: (r) => (
                  <>
                    <div className="font-[family-name:var(--font-ui)] font-semibold tracking-wide">
                      {r.nombre}
                    </div>
                    {r.descripcion?.trim() ? (
                      <div className="mt-0.5 text-xs text-vialto-steel line-clamp-2">
                        {r.descripcion}
                      </div>
                    ) : null}
                  </>
                ),
                tdClassName: listadoTablaTdClass,
              },
              {
                id: "estado",
                header: "Estado",
                cell: (r) => (
                  <span
                    className={
                      r.activo
                        ? "text-xs uppercase tracking-wider text-emerald-800"
                        : "text-xs uppercase tracking-wider text-vialto-steel"
                    }
                  >
                    {r.activo ? "Activo" : "Inactivo"}
                  </span>
                ),
                tdClassName: listadoTablaTdClass,
              },
            ]}
            rows={error ? [] : rows}
            rowKey={(r) => r.id}
            emptyMessage={
              error
                ? "No se pudieron cargar los productos."
                : "No hay productos que coincidan."
            }
            loadingMessage="Cargando…"
            renderActions={(r) => (
              <>
                <button
                  type="button"
                  onClick={() => setModal({ mode: "view", producto: r })}
                  className={listadoTablaAccionClass}
                >
                  Ver
                </button>
                {r.activo ? (
                  <button
                    type="button"
                    onClick={() => void toggleActivo(r)}
                    className={`${listadoTablaAccionClass} text-red-900 hover:bg-red-50`}
                  >
                    Desactivar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void toggleActivo(r)}
                    className={`${listadoTablaAccionClass} text-emerald-900 hover:bg-emerald-50`}
                  >
                    Reactivar
                  </button>
                )}
              </>
            )}
            actionsTdClassName={`${listadoTablaTdClass} text-right`}
          />

          {meta && (rows?.length ?? 0) > 0 && (
            <div className="mt-4">
              <ListadoPagination
                meta={meta}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
              />
            </div>
          )}
        </>
      )}

      {!filtroEmpresa && (
        <p className="mt-8 text-vialto-steel">
          Seleccioná una empresa para ver y gestionar su catálogo de productos.
        </p>
      )}

      {modal.mode === "view" && filtroEmpresa && (
        <ProductoModal
          modo="view"
          productoInicial={modal.producto}
          baseUrl="/api/platform/stock/productos"
          tenantId={filtroEmpresa}
          getToken={getToken}
          onClose={() => setModal({ mode: "closed" })}
          onSaved={() => {}}
          onEdit={() => setModal({ mode: "edit", producto: modal.producto })}
        />
      )}
      {modal.mode === "create" && filtroEmpresa && (
        <ProductoModal
          modo="create"
          baseUrl="/api/platform/stock/productos"
          tenantId={filtroEmpresa}
          getToken={getToken}
          onClose={() => setModal({ mode: "closed" })}
          onSaved={async () => {
            setModal({ mode: "closed" });
            await load();
          }}
        />
      )}
      {modal.mode === "edit" && filtroEmpresa && (
        <ProductoModal
          modo="edit"
          productoInicial={modal.producto}
          baseUrl="/api/platform/stock/productos"
          tenantId={filtroEmpresa}
          getToken={getToken}
          onClose={() => setModal({ mode: "closed" })}
          onSaved={async () => {
            setModal({ mode: "closed" });
            await load();
          }}
        />
      )}
    </div>
  );
}
