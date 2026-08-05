import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DireccionEntregaViewModal } from "@/components/direcciones-entrega/DireccionEntregaViewModal";
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
import type { DireccionEntrega, PaginatedMeta } from "@/types/api";

export function DireccionesEntregaTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [rows, setRows] = useState<DireccionEntrega[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingDireccion, setViewingDireccion] = useState("");

  // --- ESTADOS DE PAGINACIÓN ---
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(
    LISTADO_PAGE_SIZE_OPTIONS[0] || 10,
  );
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);

  // Estados de los filtros de columna
  const [filtroDireccion, setFiltroDireccion] = useState("");

  function limpiarFiltros() {
    setFiltroDireccion("");
    setPage(1);
  }

  const anyFiltroActivo = !!filtroDireccion;

  // Extracción de opciones únicas para los selectores
  const opcionesDireccion = useMemo(
    () =>
      Array.from(
        new Set(
          (rows || []).map((r) => r.direccion).filter((v): v is string => !!v),
        ),
      ).sort(),
    [rows],
  );

  const rowsFiltradas = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (filtroDireccion && r.direccion !== filtroDireccion) return false;
      return true;
    });
  }, [rows, filtroDireccion]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Hacemos el fetch esperando que el backend pueda devolver diferentes formatos
        const response = await apiJson<any>(
          `/api/direcciones-entrega/paginated?page=${page}&pageSize=${pageSize}`,
          () => getToken(),
        );

        if (!cancelled) {
          let fetchedRows: DireccionEntrega[] = [];
          let fetchedMeta: PaginatedMeta | null = null;

          // Extracción segura y paginación en frontend (fallback)
          if (Array.isArray(response)) {
            // Si el backend devuelve un arreglo directo (todas las direcciones juntas)
            const totalItems = response.length;
            const calculatedTotalPages = Math.ceil(totalItems / pageSize) || 1;

            // Evita que la página actual sea mayor al total de páginas posibles
            const safePage =
              page > calculatedTotalPages ? calculatedTotalPages : page;

            // Recortamos el array para simular la paginación en el cliente
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
            // Formato { data: [...], meta: {...} }
            fetchedRows = response.data;
            fetchedMeta = response.meta || null;
          } else if (response && response.items) {
            // Formato { items: [...], meta: {...} }
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
          setError(friendlyError(e, "direccionesEntrega"));
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
        Direcciones / Ruta de entrega
      </h1>
      <p className="mt-2 text-vialto-steel">
        Direcciones y rutas frecuentes para egresos de stock.
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
          to="/direcciones-entrega/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Crear dirección
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
                title="Dirección / Ruta"
                filterActive={!!filtroDireccion}
                filterSignature={filtroDireccion}
              >
                <select
                  value={filtroDireccion}
                  onChange={(e) => {
                    setFiltroDireccion(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroDireccion
                      ? "text-vialto-fire"
                      : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por Dirección"
                >
                  <option value="">Todas</option>
                  {opcionesDireccion.map((o) => (
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
            id: "direccion",
            header: "Dirección / Ruta",
            primary: true,
            cell: (d) => d.direccion,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
        ]}
        rows={error ? [] : rowsFiltradas}
        rowKey={(d) => d.id}
        emptyMessage={
          error
            ? "No se pudieron cargar las direcciones."
            : anyFiltroActivo
              ? "No hay direcciones que coincidan con los filtros aplicados."
              : "Todavía no hay direcciones cargadas."
        }
        loadingMessage="Cargando…"
        renderActions={(d) => (
          <button
            type="button"
            onClick={() => {
              setViewingId(d.id);
              setViewingDireccion(d.direccion);
            }}
            className={listadoTablaAccionClass}
          >
            Ver
          </button>
        )}
      />

      {/* COMPONENTE DE PAGINACIÓN */}
      {meta && (rowsFiltradas?.length ?? 0) > 0 && (
        <ListadoPagination
          meta={meta}
          pageSize={pageSize}
          loading={loading}
          totalLabel="direcciones"
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}

      {viewingId && (
        <DireccionEntregaViewModal
          direccionEntregaId={viewingId}
          direccionTitulo={viewingDireccion}
          onClose={() => {
            setViewingId(null);
            setViewingDireccion("");
          }}
          editTo={`/direcciones-entrega/${viewingId}/editar`}
        />
      )}
    </div>
  );
}
