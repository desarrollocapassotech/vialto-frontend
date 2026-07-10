import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { VehiculoViewModal } from "@/components/vehiculos/VehiculoViewModal";
import { EmpresaFilterBar } from "@/components/superadmin/EmpresaFilterBar";
import { useTenantsList } from "@/hooks/useTenantsList";
import { useTransportistasList } from "@/hooks/useTransportistasList";
import { useTenantFiltroUrl } from "@/hooks/useTenantFiltroUrl";
import { apiJson } from "@/lib/api";
import { labelVehiculoTipo } from "@/lib/labels";
import {
  labelAsignacionTransportista,
  mapTransportistaNombres,
} from "@/lib/transportistas";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
} from "@/lib/listadoTabla";
import { LISTADO_PAGE_SIZE_OPTIONS } from "@/lib/listadoPaginacion";
import type { ConEmpresa, PaginatedMeta, Vehiculo } from "@/types/api";

export function VehiculosSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { filtroEmpresa, onChangeTenant } = useTenantFiltroUrl();
  const transportistas = useTransportistasList(
    filtroEmpresa || undefined,
    !filtroEmpresa,
  );
  const nombresTransportistas = useMemo(
    () => mapTransportistaNombres(transportistas ?? []),
    [transportistas],
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(
    LISTADO_PAGE_SIZE_OPTIONS[0] || 10,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingVehiculoId, setViewingVehiculoId] = useState<string | null>(
    null,
  );
  const [viewingVehiculoPatente, setViewingVehiculoPatente] = useState("");
  const tenants = useTenantsList();
  const [allRows, setAllRows] = useState<ConEmpresa<Vehiculo>[] | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setAllRows(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setAllRows(null);
    setLoading(true);
    (async () => {
      try {
        const raw = await apiJson<unknown>(
          `/api/platform/vehiculos?tenantId=${encodeURIComponent(filtroEmpresa)}`,
          () => getToken(),
        );
        const asObj = raw as { items?: ConEmpresa<Vehiculo>[] };
        const items = Array.isArray(raw)
          ? (raw as ConEmpresa<Vehiculo>[])
          : (asObj.items ?? []);
        if (!cancelled) {
          setAllRows(items);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setAllRows(null);
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

  const { rows, meta } = useMemo(() => {
    if (allRows === null) return { rows: null, meta: null };
    const total = allRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pageSafe = Math.min(page, totalPages);
    const start = (pageSafe - 1) * pageSize;
    const slice = allRows.slice(start, start + pageSize);
    const meta: PaginatedMeta = {
      page: pageSafe,
      pageSize,
      total,
      totalPages,
      hasPrev: pageSafe > 1,
      hasNext: pageSafe < totalPages,
    };
    return { rows: slice, meta };
  }, [allRows, page, pageSize]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Vehículos
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para ver sus vehículos. El listado lo filtra el
        servidor.
      </p>
      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenants}
          value={filtroEmpresa}
          onChange={(id) => {
            setPage(1);
            onChangeTenant(id);
          }}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Link
          to={
            filtroEmpresa
              ? `/vehiculos/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
              : "#"
          }
          className={`inline-flex h-10 items-center px-4 text-white text-sm uppercase tracking-wider ${
            filtroEmpresa
              ? "bg-vialto-charcoal hover:bg-vialto-graphite"
              : "bg-vialto-charcoal/50 pointer-events-none"
          }`}
          aria-disabled={!filtroEmpresa}
        >
          Crear vehículo
        </Link>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoDatos
        className="mt-8"
        columns={[
          {
            id: "patente",
            header: "Patente",
            primary: true,
            cell: (v) => v.patente,
            tdClassName: `${listadoTablaTdClass} font-[family-name:var(--font-ui)] tracking-wider font-semibold`,
          },
          {
            id: "tipoMarca",
            header: "Tipo y marca",
            cell: (v) => (
              <>
                {labelVehiculoTipo(v.tipo)}
                {v.marca ? ` · ${v.marca}` : ""}
              </>
            ),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "pertenencia",
            header: "Pertenencia",
            cell: (v) =>
              labelAsignacionTransportista(
                v.transportistaId,
                nombresTransportistas,
              ),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={!filtroEmpresa || error ? [] : rows}
        rowKey={(v) => v.id}
        emptyMessage={
          !filtroEmpresa
            ? "Seleccioná una empresa para ver los vehículos."
            : error
              ? "No se pudieron cargar los vehículos."
              : "No hay vehículos cargados para esta empresa."
        }
        loadingMessage="Cargando…"
        renderActions={(v) => (
          <div className="inline-flex gap-2">
            <button
              type="button"
              onClick={() => {
                setViewingVehiculoId(v.id);
                setViewingVehiculoPatente(v.patente);
              }}
              className={listadoTablaAccionClass}
            >
              Ver
            </button>
            <Link
              to={`/vehiculos/${encodeURIComponent(v.id)}/editar?tenantId=${encodeURIComponent(filtroEmpresa)}`}
              className={listadoTablaAccionClass}
            >
              Editar
            </Link>
          </div>
        )}
      />

      {filtroEmpresa && !error && meta && meta.total > 0 && (
        <ListadoPagination
          meta={meta}
          pageSize={pageSize}
          loading={loading}
          totalLabel="vehículos"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}

      {viewingVehiculoId && (
        <VehiculoViewModal
          vehiculoId={viewingVehiculoId}
          patenteTitulo={viewingVehiculoPatente}
          tenantId={filtroEmpresa}
          onClose={() => {
            setViewingVehiculoId(null);
            setViewingVehiculoPatente("");
          }}
          editTo={`/vehiculos/${encodeURIComponent(viewingVehiculoId)}/editar?tenantId=${encodeURIComponent(filtroEmpresa)}`}
        />
      )}
    </div>
  );
}
