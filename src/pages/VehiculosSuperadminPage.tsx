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
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { LISTADO_PAGE_SIZE_OPTIONS } from "@/lib/listadoPaginacion";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
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

  // Estados de los filtros de columna
  const [filtroPatente, setFiltroPatente] = useState("");
  const [filtroPertenencia, setFiltroPertenencia] = useState("");

  function limpiarFiltros() {
    setFiltroPatente("");
    setFiltroPertenencia("");
    setPage(1);
  }

  const anyFiltroActivo = !!filtroPatente || !!filtroPertenencia;

  // Extracción de opciones únicas
  const opcionesPatente = useMemo(
    () =>
      Array.from(
        new Set(
          (allRows || []).map((r) => r.patente).filter((v): v is string => !!v),
        ),
      ).sort(),
    [allRows],
  );
  const opcionesPertenencia = useMemo(
    () =>
      Array.from(
        new Set(
          (allRows || [])
            .map((r) =>
              labelAsignacionTransportista(
                r.transportistaId,
                nombresTransportistas,
              ),
            )
            .filter((v): v is string => !!v),
        ),
      ).sort(),
    [allRows, nombresTransportistas],
  );

  const rowsFiltradas = useMemo(() => {
    if (!allRows) return [];
    return allRows.filter((r) => {
      if (filtroPatente && r.patente !== filtroPatente) return false;
      if (
        filtroPertenencia &&
        labelAsignacionTransportista(
          r.transportistaId,
          nombresTransportistas,
        ) !== filtroPertenencia
      )
        return false;
      return true;
    });
  }, [allRows, filtroPatente, filtroPertenencia, nombresTransportistas]);

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
    if (rowsFiltradas === null) return { rows: null, meta: null };
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
    return { rows: slice, meta };
  }, [rowsFiltradas, page, pageSize]);

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
        className="mt-6"
        tableColSpan={4}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Patente"
                filterActive={!!filtroPatente}
                filterSignature={filtroPatente}
              >
                <select
                  value={filtroPatente}
                  onChange={(e) => {
                    setFiltroPatente(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroPatente ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por Patente"
                >
                  <option value="">Todas</option>
                  {opcionesPatente.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Tipo y marca
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Pertenencia"
                filterActive={!!filtroPertenencia}
                filterSignature={filtroPertenencia}
              >
                <select
                  value={filtroPertenencia}
                  onChange={(e) => {
                    setFiltroPertenencia(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroPertenencia
                      ? "text-vialto-fire"
                      : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por Pertenencia"
                >
                  <option value="">Todas</option>
                  {opcionesPertenencia.map((o) => (
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
              : anyFiltroActivo
                ? "No hay vehículos que coincidan con los filtros aplicados."
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
