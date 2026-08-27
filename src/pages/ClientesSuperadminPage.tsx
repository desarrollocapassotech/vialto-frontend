import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClienteViewModal } from "@/components/clientes/ClienteViewModal";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { apiJson } from "@/lib/api";
import { condicionIvaLabel } from "@/lib/arcaCbteTipo";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { LISTADO_PAGE_SIZE_OPTIONS } from "@/lib/listadoPaginacion";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { Cliente, ConEmpresa, PaginatedMeta } from "@/types/api";

export function ClientesSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<ConEmpresa<Cliente>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(
    LISTADO_PAGE_SIZE_OPTIONS[0] || 10,
  );
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null);
  const tenants = useTenantsList();

  // Estados de los filtros de columna
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroIdFiscal, setFiltroIdFiscal] = useState("");
  const [filtroPais, setFiltroPais] = useState("");

  function limpiarFiltros() {
    setFiltroNombre("");
    setFiltroIdFiscal("");
    setFiltroPais("");
    setPage(1);
  }

  const anyFiltroActivo = !!filtroNombre || !!filtroIdFiscal || !!filtroPais;

  // Extracción de opciones únicas para los selectores
  const opcionesNombre = useMemo(
    () =>
      Array.from(
        new Set(
          (rows || []).map((r) => r.nombre).filter((v): v is string => !!v),
        ),
      ).sort(),
    [rows],
  );
  const opcionesIdFiscal = useMemo(
    () =>
      Array.from(
        new Set(
          (rows || []).map((r) => r.idFiscal).filter((v): v is string => !!v),
        ),
      ).sort(),
    [rows],
  );
  const opcionesPais = useMemo(
    () =>
      Array.from(
        new Set(
          (rows || []).map((r) => r.pais).filter((v): v is string => !!v),
        ),
      ).sort(),
    [rows],
  );

  const rowsFiltradas = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (filtroNombre && r.nombre !== filtroNombre) return false;
      if (filtroIdFiscal && r.idFiscal !== filtroIdFiscal) return false;
      if (filtroPais && r.pais !== filtroPais) return false;
      return true;
    });
  }, [rows, filtroNombre, filtroIdFiscal, filtroPais]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setRows(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setRows(null);
    setLoading(true);
    (async () => {
      try {
        const raw = await apiJson<unknown>(
          `/api/platform/clientes?tenantId=${encodeURIComponent(filtroEmpresa)}`,
          () => getToken(),
        );
        const asObj = raw as { items?: ConEmpresa<Cliente>[] };
        const items = Array.isArray(raw)
          ? (raw as ConEmpresa<Cliente>[])
          : (asObj.items ?? []);
        if (!cancelled) {
          setRows(items);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, "plataforma"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, filtroEmpresa]);

  const { rowsPagina, meta } = useMemo(() => {
    if (rows === null || rowsFiltradas == null) {
      return { rowsPagina: null, meta: null };
    }
    const total = rowsFiltradas.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pageSafe = Math.min(page, totalPages);
    const start = (pageSafe - 1) * pageSize;
    const slice = rowsFiltradas.slice(start, start + pageSize);
    const meta: PaginatedMeta = {
      page: pageSafe,
      pageSize,
      total,
      totalPages,
      hasPrev: pageSafe > 1,
      hasNext: pageSafe < totalPages,
    };
    return { rowsPagina: slice, meta };
  }, [rows, rowsFiltradas, page, pageSize]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Clientes
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para ver sus clientes. Los datos los filtra el
        servidor.
      </p>

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={(id) => {
            setPage(1);
            limpiarFiltros();
            onChangeTenant(id);
          }}
        />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        {anyFiltroActivo && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="hidden lg:inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
          >
            Limpiar filtros
          </button>
        )}
        <Link
          to={
            filtroEmpresa
              ? `/clientes/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
              : "#"
          }
          className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
            filtroEmpresa
              ? "bg-vialto-charcoal hover:bg-vialto-graphite"
              : "bg-vialto-charcoal/50 pointer-events-none"
          }`}
          aria-disabled={!filtroEmpresa}
        >
          Crear cliente
        </Link>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoDatos
        className="mt-6"
        tableColSpan={6}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Nombre"
                filterActive={!!filtroNombre}
                filterSignature={filtroNombre}
              >
                <select
                  value={filtroNombre}
                  onChange={(e) => {
                    setFiltroNombre(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroNombre ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por Nombre"
                >
                  <option value="">Todos</option>
                  {opcionesNombre.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="ID Fiscal"
                filterActive={!!filtroIdFiscal}
                filterSignature={filtroIdFiscal}
              >
                <select
                  value={filtroIdFiscal}
                  onChange={(e) => {
                    setFiltroIdFiscal(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroIdFiscal ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por ID Fiscal"
                >
                  <option value="">Todos</option>
                  {opcionesIdFiscal.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="País"
                filterActive={!!filtroPais}
                filterSignature={filtroPais}
              >
                <select
                  value={filtroPais}
                  onChange={(e) => {
                    setFiltroPais(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroPais ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por País"
                >
                  <option value="">Todos</option>
                  {opcionesPais.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Dirección
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Contacto
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
        columns={[
          {
            id: "nombre",
            header: "Nombre",
            primary: true,
            cell: (c) => c.nombre,
            tdClassName: listadoTablaTdClass,
          },
          {
            id: "idFiscal",
            header: "ID Fiscal",
            cell: (c) => c.idFiscal ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "pais",
            header: "País",
            cell: (c) => c.pais ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "condicionTributaria",
            header: "Condición tributaria",
            cell: (c) =>
              c.pais === "AR"
                ? c.condicionIva != null
                  ? condicionIvaLabel(c.condicionIva)
                  : "—"
                : (c.condicionTributaria ?? "—"),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "direccion",
            header: "Dirección",
            cell: (c) => c.direccion ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "contacto",
            header: "Contacto",
            cell: (c) => c.email ?? c.telefono ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={!filtroEmpresa || error ? [] : rowsPagina}
        rowKey={(c) => c.id}
        emptyMessage={
          !filtroEmpresa
            ? "Seleccioná una empresa para ver los clientes."
            : error
              ? "No se pudieron cargar los clientes."
              : anyFiltroActivo
                ? "No hay clientes que coincidan con los filtros aplicados."
                : "No hay clientes cargados para esta empresa."
        }
        loadingMessage="Cargando…"
        renderActions={(c) => (
          <button
            type="button"
            onClick={() => setViewingCliente(c)}
            className={listadoTablaAccionClass}
          >
            Ver
          </button>
        )}
      />

      {filtroEmpresa && !error && meta && meta.total > 0 && (
        <ListadoPagination
          meta={meta}
          pageSize={pageSize}
          loading={loading}
          totalLabel="clientes"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}

      {viewingCliente && (
        <ClienteViewModal
          cliente={viewingCliente}
          onClose={() => setViewingCliente(null)}
          editTo={`/clientes/${encodeURIComponent(viewingCliente.id)}/editar?tenantId=${encodeURIComponent(filtroEmpresa)}`}
        />
      )}
    </div>
  );
}
