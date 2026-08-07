import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DestinatarioViewModal } from "@/components/destinatarios/DestinatarioViewModal";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { LISTADO_PAGE_SIZE_OPTIONS } from "@/lib/listadoPaginacion";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { Destinatario, PaginatedMeta } from "@/types/api";

export function DestinatariosTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [rows, setRows] = useState<Destinatario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingNombre, setViewingNombre] = useState("");

  // --- ESTADOS DE PAGINACIÓN ---
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(
    LISTADO_PAGE_SIZE_OPTIONS[0] || 10,
  );
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);

  // Estados de los filtros de columna
  const [filtroNombre, setFiltroNombre] = useState("");

  function limpiarFiltros() {
    setFiltroNombre("");
    setPage(1);
  }

  const anyFiltroActivo = !!filtroNombre;

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

  const rowsFiltradas = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (filtroNombre && r.nombre !== filtroNombre) return false;
      return true;
    });
  }, [rows, filtroNombre]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const response = await apiJson<any>(
          `/api/destinatarios/paginated?page=${page}&pageSize=${pageSize}`,
          () => getToken(),
        );

        if (!cancelled) {
          let fetchedRows: Destinatario[] = [];
          let fetchedMeta: PaginatedMeta | null = null;

          // Extracción segura y paginación en el frontend si es necesario
          if (Array.isArray(response)) {
            const totalItems = response.length;
            const calculatedTotalPages = Math.ceil(totalItems / pageSize) || 1;

            // Aseguramos no estar en una página fuera de rango
            const safePage =
              page > calculatedTotalPages ? calculatedTotalPages : page;

            // Recortamos el array
            const startIndex = (safePage - 1) * pageSize;
            const endIndex = startIndex + pageSize;

            fetchedRows = response.slice(startIndex, endIndex);
            fetchedMeta = {
              page: safePage,
              pageSize: pageSize,
              totalPages: calculatedTotalPages,
              total: totalItems,
              hasNext: safePage < calculatedTotalPages,
              hasPrev: safePage > 1,
            };
          } else if (response && response.data) {
            fetchedRows = response.data;
            fetchedMeta = response.meta || null;
          } else if (response && response.items) {
            fetchedRows = response.items;
            fetchedMeta = response.meta || null;
          }

          setRows(fetchedRows);
          setMeta(fetchedMeta);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setMeta(null);
          setError(friendlyError(e, "destinatarios"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, page, pageSize]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Destinatarios
      </h1>
      <p className="mt-2 text-vialto-steel">
        Empresas o personas que reciben mercadería en egresos de stock.
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
          to="/destinatarios/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Crear destinatario
        </Link>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoDatos
        className={`mt-6 ${loading ? "opacity-50 pointer-events-none" : ""}`}
        tableColSpan={2}
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
            cell: (d) => d.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
        ]}
        rows={error ? [] : rowsFiltradas}
        rowKey={(d) => d.id}
        emptyMessage={
          error
            ? "No se pudieron cargar los destinatarios."
            : anyFiltroActivo
              ? "No hay destinatarios que coincidan con los filtros aplicados."
              : "Todavía no hay destinatarios cargados."
        }
        loadingMessage="Cargando…"
        renderActions={(d) => (
          <button
            type="button"
            onClick={() => {
              setViewingId(d.id);
              setViewingNombre(d.nombre);
            }}
            className={listadoTablaAccionClass}
          >
            Ver
          </button>
        )}
      />

      {/* COMPONENTE DE PAGINACIÓN */}
      {meta && rows && rows.length > 0 && (
        <ListadoPagination
          meta={meta}
          pageSize={pageSize}
          loading={loading}
          totalLabel="destinatarios"
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1); // Reiniciar a página 1 al cambiar la cantidad
          }}
        />
      )}

      {viewingId && (
        <DestinatarioViewModal
          destinatarioId={viewingId}
          nombreTitulo={viewingNombre}
          onClose={() => {
            setViewingId(null);
            setViewingNombre("");
          }}
          editTo={`/destinatarios/${viewingId}/editar`}
        />
      )}
    </div>
  );
}
