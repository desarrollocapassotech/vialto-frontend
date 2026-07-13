import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
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
} from "@/lib/listadoTabla";
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

      <div className="mt-4 flex justify-end">
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
        className={`mt-8 ${loading ? "opacity-50 pointer-events-none" : ""}`}
        columns={[
          {
            id: "nombre",
            header: "Nombre",
            primary: true,
            cell: (d) => d.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
        ]}
        rows={error ? [] : rows}
        rowKey={(d) => d.id}
        emptyMessage={
          error
            ? "No se pudieron cargar los destinatarios."
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
