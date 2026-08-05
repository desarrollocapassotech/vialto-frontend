import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { VehiculoViewModal } from "@/components/vehiculos/VehiculoViewModal";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { apiJson } from "@/lib/api";
import { labelVehiculoTipo } from "@/lib/labels";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import type { PaginatedMeta, Vehiculo } from "@/types/api";

type VehiculosPaginatedResponse = {
  items: Vehiculo[];
  meta: PaginatedMeta;
};

const TIPO_OPCIONES = [
  { value: "", label: "Todos" },
  { value: "tractor", label: "Tractor" },
  { value: "semirremolque", label: "Semirremolque" },
  { value: "camion", label: "Camión" },
  { value: "utilitario", label: "Utilitario" },
  { value: "otro", label: "Otro" },
] as const;

export function VehiculosTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<Vehiculo[] | null>(null);
  const [serverMeta, setServerMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingVehiculoId, setViewingVehiculoId] = useState<string | null>(
    null,
  );
  const [viewingVehiculoPatente, setViewingVehiculoPatente] = useState("");

  // Estados de los filtros de columna
  const [filtroPatente, setFiltroPatente] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("");

  function limpiarFiltros() {
    setFiltroPatente("");
    setFiltroTipo("");
    setFiltroMarca("");
    setPage(1);
  }

  const anyFiltroActivo = !!filtroPatente || !!filtroTipo || !!filtroMarca;

  // Extracción de opciones únicas para los selectores
  const opcionesPatente = useMemo(
    () =>
      Array.from(
        new Set(
          (rows || []).map((r) => r.patente).filter((v): v is string => !!v),
        ),
      ).sort(),
    [rows],
  );
  const opcionesMarca = useMemo(
    () =>
      Array.from(
        new Set(
          (rows || []).map((r) => r.marca).filter((v): v is string => !!v),
        ),
      ).sort(),
    [rows],
  );

  const rowsFiltradas = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (filtroPatente && r.patente !== filtroPatente) return false;
      if (filtroTipo && r.tipo !== filtroTipo) return false;
      if (filtroMarca && r.marca !== filtroMarca) return false;
      return true;
    });
  }, [rows, filtroPatente, filtroTipo, filtroMarca]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        const data = await apiJson<VehiculosPaginatedResponse>(
          `/api/vehiculos/paginated?${params.toString()}`,
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
          setError(friendlyError(e, "vehiculos"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, page, pageSize]);

  const tipoSelectClass = (activo: boolean) =>
    `h-9 w-full border border-black/15 bg-white px-2 text-sm ${
      activo ? "text-vialto-fire" : "text-vialto-charcoal"
    }`;

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Vehículos
      </h1>
      <p className="mt-2 text-vialto-steel">
        Patentes, tipo y marca de cada unidad de tu flota.
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
          to="/vehiculos/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
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
        tableColSpan={5}
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
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Tipo"
                filterActive={!!filtroTipo}
                filterSignature={filtroTipo}
              >
                <select
                  value={filtroTipo}
                  onChange={(e) => {
                    setFiltroTipo(e.target.value);
                    setPage(1);
                  }}
                  className={tipoSelectClass(!!filtroTipo)}
                  aria-label="Filtrar por tipo de vehículo"
                >
                  {TIPO_OPCIONES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Marca"
                filterActive={!!filtroMarca}
                filterSignature={filtroMarca}
              >
                <select
                  value={filtroMarca}
                  onChange={(e) => {
                    setFiltroMarca(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroMarca ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por Marca"
                >
                  <option value="">Todas</option>
                  {opcionesMarca.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Modelo
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
            id: "tipo",
            header: "Tipo",
            cell: (v) => labelVehiculoTipo(v.tipo),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "marca",
            header: "Marca",
            cell: (v) => v.marca ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "modelo",
            header: "Modelo",
            cell: (v) => v.modelo ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : rowsFiltradas}
        rowKey={(v) => v.id}
        emptyMessage={
          error
            ? "No se pudieron cargar los vehículos."
            : anyFiltroActivo
              ? "No hay vehículos que coincidan con los filtros aplicados."
              : "Todavía no tenés vehículos cargados."
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
              to={`/vehiculos/${encodeURIComponent(v.id)}/editar`}
              className={listadoTablaAccionClass}
            >
              Editar
            </Link>
          </div>
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

      {viewingVehiculoId && (
        <VehiculoViewModal
          vehiculoId={viewingVehiculoId}
          patenteTitulo={viewingVehiculoPatente}
          onClose={() => {
            setViewingVehiculoId(null);
            setViewingVehiculoPatente("");
          }}
          editTo={`/vehiculos/${encodeURIComponent(viewingVehiculoId)}/editar`}
        />
      )}
    </div>
  );
}
