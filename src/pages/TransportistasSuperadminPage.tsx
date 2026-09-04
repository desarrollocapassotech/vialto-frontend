import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { TransportistaViewModal } from "@/components/transportistas/TransportistaViewModal";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  metaPaginacionCliente,
  slicePaginaCliente,
} from "@/lib/listadoPaginacion";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { ConEmpresa, Transportista } from "@/types/api";

export function TransportistasSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<ConEmpresa<Transportista>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const [viewingTransportista, setViewingTransportista] =
    useState<Transportista | null>(null);
  const tenants = useTenantsList();

  const { isVisible } = useFieldConfig("transportistas");
  const idFiscalVisible = isVisible("detalle_transportista", "idFiscal");
  const paisVisible = isVisible("detalle_transportista", "pais");
  const emailVisible = isVisible("detalle_transportista", "email");
  const telefonoVisible = isVisible("detalle_transportista", "telefono");
  const pautVisible = isVisible("detalle_transportista", "paut");

  const contactoVisible = emailVisible || telefonoVisible;

  // Estados de los filtros de columna
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroIdFiscal, setFiltroIdFiscal] = useState("");
  const [filtroPais, setFiltroPais] = useState("");
  const [filtroPaut, setFiltroPaut] = useState("");

  function limpiarFiltros() {
    setFiltroNombre("");
    setFiltroIdFiscal("");
    setFiltroPais("");
    setFiltroPaut("");
    setPage(1);
  }

  const anyFiltroActivo =
    !!filtroNombre || !!filtroIdFiscal || !!filtroPais || !!filtroPaut;

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
  const opcionesPaut = useMemo(
    () =>
      Array.from(
        new Set(
          (rows || []).map((r) => r.paut).filter((v): v is string => !!v),
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
      if (filtroPaut && r.paut !== filtroPaut) return false;
      return true;
    });
  }, [rows, filtroNombre, filtroIdFiscal, filtroPais, filtroPaut]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setRows(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setRows(null);
    (async () => {
      try {
        const data = await apiJson<ConEmpresa<Transportista>[]>(
          `/api/platform/transportistas?tenantId=${encodeURIComponent(filtroEmpresa)}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setError(friendlyError(e, "plataforma"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, filtroEmpresa]);

  const metaListado = useMemo(() => {
    const total = rowsFiltradas?.length ?? 0;
    return metaPaginacionCliente(total, page, pageSize);
  }, [rowsFiltradas, page, pageSize]);

  const filasPagina = useMemo(() => {
    if (rowsFiltradas === null) return null;
    return slicePaginaCliente(rowsFiltradas, page, pageSize);
  }, [rowsFiltradas, page, pageSize]);

  function cambiarPageSize(nuevoSize: number) {
    setPageSize(nuevoSize);
    setPage(1);
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Transportistas
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para ver y administrar sus transportistas.
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
              ? `/transportistas/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
              : "#"
          }
          className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
            filtroEmpresa
              ? "bg-vialto-charcoal hover:bg-vialto-graphite"
              : "bg-vialto-charcoal/50 pointer-events-none"
          }`}
          aria-disabled={!filtroEmpresa}
        >
          Crear transportista
        </Link>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoDatos
        className="mt-6"
        tableColSpan={2 + (idFiscalVisible ? 1 : 0) + (paisVisible ? 1 : 0) + (contactoVisible ? 1 : 0) + (pautVisible ? 1 : 0)}
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
            {idFiscalVisible && (
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
            )}
            {paisVisible && (
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
            )}
            {contactoVisible && (
              <th scope="col" className={listadoTablaThClass}>
                Contacto
              </th>
            )}
            {pautVisible && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="N° PAUT"
                filterActive={!!filtroPaut}
                filterSignature={filtroPaut}
              >
                <select
                  value={filtroPaut}
                  onChange={(e) => {
                    setFiltroPaut(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroPaut ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por PAUT"
                >
                  <option value="">Todos</option>
                  {opcionesPaut.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            )}
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
            cell: (t) => t.nombre,
            tdClassName: listadoTablaTdClass,
          },
          ...(idFiscalVisible ? [{
            id: "idFiscal",
            header: "ID Fiscal",
            cell: (t: Transportista) => t.idFiscal ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          }] : []),
          ...(paisVisible ? [{
            id: "pais",
            header: "País",
            cell: (t: Transportista) => t.pais ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          }] : []),
          ...(contactoVisible ? [{
            id: "contacto",
            header: "Contacto",
            cell: (t: Transportista) => t.email ?? t.telefono ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          }] : []),
          ...(pautVisible ? [{
            id: "paut",
            header: "N° PAUT",
            cell: (t: Transportista) => t.paut ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          }] : []),
        ]}
        rows={!filtroEmpresa || error ? [] : filasPagina}
        rowKey={(t) => t.id}
        emptyMessage={
          !filtroEmpresa
            ? "Seleccioná una empresa para ver los transportistas."
            : error
              ? "No se pudieron cargar los transportistas."
              : anyFiltroActivo
                ? "No hay transportistas que coincidan con los filtros aplicados."
                : "No hay transportistas cargados para esta empresa."
        }
        loadingMessage="Cargando…"
        renderActions={(t) => (
          <button
            type="button"
            onClick={() => setViewingTransportista(t)}
            className={listadoTablaAccionClass}
          >
            Ver
          </button>
        )}
      />

      {metaListado.total > 0 && filtroEmpresa && !error && (
        <ListadoPagination
          meta={metaListado}
          pageSize={pageSize}
          totalLabel="transportistas"
          onPageChange={setPage}
          onPageSizeChange={cambiarPageSize}
        />
      )}

      {viewingTransportista && (
        <TransportistaViewModal
          transportista={viewingTransportista}
          onClose={() => setViewingTransportista(null)}
          editTo={`/transportistas/${encodeURIComponent(viewingTransportista.id)}/editar?tenantId=${encodeURIComponent(filtroEmpresa)}`}
        />
      )}
    </div>
  );
}
