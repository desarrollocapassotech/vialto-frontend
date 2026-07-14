import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DireccionEntregaViewModal } from "@/components/direcciones-entrega/DireccionEntregaViewModal";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { LISTADO_PAGE_SIZE_OPTIONS } from "@/lib/listadoPaginacion";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
} from "@/lib/listadoTabla";
import type { ConEmpresa, DireccionEntrega, PaginatedMeta } from "@/types/api";

export function DireccionesEntregaSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const tenants = useTenantsList();

  const [rows, setRows] = useState<ConEmpresa<DireccionEntrega>[] | null>(null);
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

  // Reiniciar a la página 1 cuando se cambia de empresa
  useEffect(() => {
    setPage(1);
  }, [filtroEmpresa]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setRows(null);
      setMeta(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const response = await apiJson<any>(
          `/api/platform/direcciones-entrega?tenantId=${encodeURIComponent(
            filtroEmpresa,
          )}&page=${page}&limit=${pageSize}`,
          () => getToken(),
        );

        if (!cancelled) {
          let fetchedRows: ConEmpresa<DireccionEntrega>[] = [];
          let fetchedMeta: PaginatedMeta | null = null;

          // Extracción segura y paginación en frontend si es necesario
          if (Array.isArray(response)) {
            // El backend devolvió todo de golpe. Calculamos la paginación acá:
            const totalItems = response.length;
            const calculatedTotalPages = Math.ceil(totalItems / pageSize) || 1;

            // Aseguramos no estar en una página que no existe
            const safePage =
              page > calculatedTotalPages ? calculatedTotalPages : page;

            // Recortamos el array para mostrar solo los de la página actual
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
          setError(friendlyError(e, "plataforma"));
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
  }, [getToken, isLoaded, isSignedIn, filtroEmpresa, page, pageSize]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Direcciones / Ruta de entrega
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para ver sus direcciones y rutas de entrega.
      </p>
      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={onChangeTenant}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Link
          to={
            filtroEmpresa
              ? `/direcciones-entrega/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
              : "#"
          }
          className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
            filtroEmpresa
              ? "bg-vialto-charcoal hover:bg-vialto-graphite"
              : "bg-vialto-charcoal/50 pointer-events-none"
          }`}
          aria-disabled={!filtroEmpresa}
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
        className={`mt-8 ${loading ? "opacity-50 pointer-events-none" : ""}`}
        columns={[
          {
            id: "direccion",
            header: "Dirección / Ruta",
            primary: true,
            cell: (d) => d.direccion,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
          {
            id: "empresa",
            header: "Empresa",
            cell: (d) => d.empresaNombre ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={filtroEmpresa ? (error ? [] : rows) : []}
        rowKey={(d) => d.id}
        emptyMessage={
          !filtroEmpresa
            ? "Seleccioná una empresa para ver direcciones."
            : error
              ? "No se pudieron cargar las direcciones."
              : "No hay direcciones para esta empresa."
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

      {meta && rows && rows.length > 0 && (
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

      {viewingId && filtroEmpresa && (
        <DireccionEntregaViewModal
          direccionEntregaId={viewingId}
          direccionTitulo={viewingDireccion}
          tenantId={filtroEmpresa}
          onClose={() => {
            setViewingId(null);
            setViewingDireccion("");
          }}
          editTo={`/direcciones-entrega/${viewingId}/editar?tenantId=${encodeURIComponent(filtroEmpresa)}`}
        />
      )}
    </div>
  );
}
