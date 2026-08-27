import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClienteViewModal } from "@/components/clientes/ClienteViewModal";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { apiJson } from "@/lib/api";
import { condicionIvaLabel } from "@/lib/arcaCbteTipo";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { Cliente, PaginatedMeta } from "@/types/api";

type ClientesPaginatedResponse = {
  items: Cliente[];
  meta: PaginatedMeta;
};

export function ClientesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Cliente[] | null>(null);
  const [serverMeta, setServerMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null);

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
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<ClientesPaginatedResponse>(
          `/api/clientes/paginated?page=${page}&pageSize=${pageSize}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data.items);
          setServerMeta(data.meta);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setServerMeta(null);
          setError(friendlyError(e, "clientes"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, page, pageSize]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide">
        Clientes
      </h1>
      <p className="mt-2 text-vialto-steel">
        Las empresas o personas a las que les prestás el servicio.
      </p>

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
          to="/clientes/nuevo"
          className="inline-flex min-h-11 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite md:min-h-0 md:h-10"
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
              Email
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Teléfono
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
            tdClassName: `${listadoTablaTdClass} font-medium`,
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
            id: "email",
            header: "Email",
            cell: (c) => c.email ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "telefono",
            header: "Teléfono",
            cell: (c) => c.telefono ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : rowsFiltradas}
        rowKey={(c) => c.id}
        emptyMessage={
          error
            ? "No se pudieron cargar los clientes."
            : anyFiltroActivo
              ? "No hay clientes que coincidan con los filtros aplicados."
              : "Todavía no tenés clientes cargados."
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

      {serverMeta && (
        <div className="mt-4">
          <ListadoPagination
            meta={serverMeta}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      )}

      {viewingCliente && (
        <ClienteViewModal
          cliente={viewingCliente}
          onClose={() => setViewingCliente(null)}
          editTo={`/clientes/${encodeURIComponent(viewingCliente.id)}/editar`}
        />
      )}
    </div>
  );
}
