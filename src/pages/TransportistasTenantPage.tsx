import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { TransportistaViewModal } from "@/components/transportistas/TransportistaViewModal";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { pageSizeListadoValido } from "@/lib/listadoPaginacion";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { PaginatedMeta, Transportista } from "@/types/api";

type TransportistasPaginatedResponse = {
  items: Transportista[];
  meta: PaginatedMeta;
};

export function TransportistasTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Transportista[] | null>(null);
  const [serverMeta, setServerMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [listadoRefetching, setListadoRefetching] = useState(false);
  const [viewingTransportista, setViewingTransportista] =
    useState<Transportista | null>(null);

  // Estados de los filtros de columna
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroIdFiscal, setFiltroIdFiscal] = useState("");

  function limpiarFiltros() {
    setFiltroNombre("");
    setFiltroIdFiscal("");
    setPage(1);
  }

  const anyFiltroActivo = !!filtroNombre || !!filtroIdFiscal;

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

  const rowsFiltradas = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (filtroNombre && r.nombre !== filtroNombre) return false;
      if (filtroIdFiscal && r.idFiscal !== filtroIdFiscal) return false;
      return true;
    });
  }, [rows, filtroNombre, filtroIdFiscal]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const pageApi = Math.max(1, Math.floor(page));
        const pageSizeApi = pageSizeListadoValido(pageSize);
        const data = await apiJson<TransportistasPaginatedResponse>(
          `/api/transportistas/paginated?page=${pageApi}&pageSize=${pageSizeApi}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data.items);
          setServerMeta(data.meta);
          setError(null);
          setListadoRefetching(false);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setServerMeta(null);
          setError(friendlyError(e, "transportistas"));
          setListadoRefetching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, page, pageSize]);

  function irAPagina(nuevaPagina: number) {
    setListadoRefetching(true);
    setPage(Math.max(1, nuevaPagina));
  }

  function cambiarPageSize(nuevoSize: number) {
    setListadoRefetching(true);
    setPageSize(nuevoSize);
    setPage(1);
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Transportistas externos
      </h1>
      <p className="mt-2 text-vialto-steel">
        Gestión de los transportistas externos (fleteros).
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
          to="/transportistas/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
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
        tableColSpan={5}
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
            cell: (t) => t.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
          {
            id: "idFiscal",
            header: "ID Fiscal",
            cell: (t) => t.idFiscal ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "email",
            header: "Email",
            cell: (t) => t.email ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "telefono",
            header: "Teléfono",
            cell: (t) => t.telefono ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : rowsFiltradas}
        rowKey={(t) => t.id}
        emptyMessage={
          error
            ? "No se pudieron cargar los transportistas."
            : anyFiltroActivo
              ? "No hay transportistas que coincidan con los filtros aplicados."
              : "Todavía no hay transportistas cargados."
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

      {serverMeta && serverMeta.total > 0 && (
        <div className="mt-4">
          <ListadoPagination
            meta={serverMeta}
            pageSize={pageSize}
            loading={listadoRefetching}
            totalLabel="transportistas"
            onPageChange={irAPagina}
            onPageSizeChange={cambiarPageSize}
          />
        </div>
      )}

      {viewingTransportista && (
        <TransportistaViewModal
          transportista={viewingTransportista}
          onClose={() => setViewingTransportista(null)}
          editTo={`/transportistas/${encodeURIComponent(viewingTransportista.id)}/editar`}
        />
      )}
    </div>
  );
}
