import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { VehiculoViewModal } from "@/components/vehiculos/VehiculoViewModal";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { apiJson } from "@/lib/api";
import { labelVehiculoTipo } from "@/lib/labels";
import { useFieldConfig } from "@/hooks/useFieldConfig";
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
  const { isVisible } = useFieldConfig("vehiculos");
  const [rows, setRows] = useState<Vehiculo[] | null>(null);
  const [serverMeta, setServerMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingVehiculoId, setViewingVehiculoId] = useState<string | null>(
    null,
  );
  const [viewingVehiculoPatente, setViewingVehiculoPatente] = useState("");

  // Estados de los filtros
  const [patenteInput, setPatenteInput] = useState("");
  const [filtroPatente, setFiltroPatente] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [marcaInput, setMarcaInput] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("");
  const [modeloInput, setModeloInput] = useState("");
  const [filtroModelo, setFiltroModelo] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<
    "todos" | "activos" | "inactivos"
  >("todos");

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      filtroActivo,
    });
    if (filtroPatente) params.set("patente", filtroPatente);
    if (filtroTipo) params.set("tipo", filtroTipo);
    if (filtroMarca) params.set("marca", filtroMarca);
    if (filtroModelo) params.set("modelo", filtroModelo);

    const data = await apiJson<VehiculosPaginatedResponse>(
      `/api/vehiculos/paginated?${params.toString()}`,
      () => getToken(),
    );
    setRows(data.items);
    setServerMeta(data.meta);
  }, [
    getToken,
    isLoaded,
    isSignedIn,
    page,
    pageSize,
    filtroPatente,
    filtroTipo,
    filtroMarca,
    filtroModelo,
    filtroActivo,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
        if (!cancelled) setError(null);
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
  }, [load]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filtroPatente) n += 1;
    if (filtroTipo) n += 1;
    if (filtroMarca) n += 1;
    if (filtroModelo) n += 1;
    if (filtroActivo !== "todos") n += 1;
    return n;
  }, [filtroPatente, filtroTipo, filtroMarca, filtroModelo, filtroActivo]);

  function limpiarFiltros() {
    setPatenteInput("");
    setFiltroPatente("");
    setFiltroTipo("");
    setMarcaInput("");
    setFiltroMarca("");
    setModeloInput("");
    setFiltroModelo("");
    setFiltroActivo("todos");
    setPage(1);
  }

  async function toggleActivo(v: Vehiculo) {
    const mensaje = v.activo
      ? `¿Desactivar el vehículo "${v.patente}"?`
      : `¿Reactivar el vehículo "${v.patente}"?`;
    if (!window.confirm(mensaje)) return;
    setError(null);
    try {
      await apiJson<Vehiculo>(
        `/api/vehiculos/${encodeURIComponent(v.id)}`,
        () => getToken(),
        { method: "PATCH", body: JSON.stringify({ activo: !v.activo }) },
      );
      await load();
    } catch (e) {
      setError(friendlyError(e, "vehiculos"));
    }
  }

  const selectClass = (activo: boolean) =>
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

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {activeFilterCount > 0 && (
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
        tableColSpan={
          2 +
          (isVisible("detalle_vehiculo", "tipo") ? 1 : 0) +
          (isVisible("detalle_vehiculo", "marca") ? 1 : 0) +
          (isVisible("detalle_vehiculo", "modelo") ? 1 : 0) +
          (isVisible("detalle_vehiculo", "activo") ? 1 : 0)
        }
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Patente"
                filterActive={!!filtroPatente}
                filterSignature={filtroPatente}
              >
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={patenteInput}
                    onChange={(e) => setPatenteInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setFiltroPatente(patenteInput.trim());
                        setPage(1);
                      }
                    }}
                    placeholder="Buscar…"
                    className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 font-mono text-sm ${
                      patenteInput.trim()
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroPatente(patenteInput.trim());
                      setPage(1);
                    }}
                    className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    OK
                  </button>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            {isVisible("detalle_vehiculo", "tipo") && (
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
                    className={selectClass(!!filtroTipo)}
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
            )}
            {isVisible("detalle_vehiculo", "marca") && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Marca"
                filterActive={!!filtroMarca}
                filterSignature={filtroMarca}
              >
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={marcaInput}
                    onChange={(e) => setMarcaInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setFiltroMarca(marcaInput.trim());
                        setPage(1);
                      }
                    }}
                    placeholder="Buscar…"
                    className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
                      marcaInput.trim()
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroMarca(marcaInput.trim());
                      setPage(1);
                    }}
                    className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    OK
                  </button>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            )}
            {isVisible("detalle_vehiculo", "modelo") && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Modelo"
                filterActive={!!filtroModelo}
                filterSignature={filtroModelo}
              >
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={modeloInput}
                    onChange={(e) => setModeloInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setFiltroModelo(modeloInput.trim());
                        setPage(1);
                      }
                    }}
                    placeholder="Buscar…"
                    className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
                      modeloInput.trim()
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroModelo(modeloInput.trim());
                      setPage(1);
                    }}
                    className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    OK
                  </button>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            )}
            {isVisible("detalle_vehiculo", "activo") && (
              <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Estado"
                filterActive={filtroActivo !== "todos"}
                filterSignature={filtroActivo}
              >
                <select
                  value={filtroActivo}
                  onChange={(e) => {
                    setFiltroActivo(
                      e.target.value as "todos" | "activos" | "inactivos",
                    );
                    setPage(1);
                  }}
                  className={selectClass(filtroActivo !== "todos")}
                  aria-label="Filtrar por estado del vehículo"
                >
                  <option value="todos">Todos</option>
                  <option value="activos">Solo activos</option>
                  <option value="inactivos">Solo inactivos</option>
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            )}
            <th
              scope="col"
              className={`${listadoTablaThClass} text-right align-top`}
            >
              Acciones
            </th>
          </tr>
        }
        columns={[
          {
            id: "patente",
            header: "Patente",
            primary: true,
            cell: (v: Vehiculo) => v.patente,
            tdClassName: `${listadoTablaTdClass} font-[family-name:var(--font-ui)] tracking-wider font-semibold`,
          },
          isVisible("detalle_vehiculo", "tipo") ? {
            id: "tipo",
            header: "Tipo",
            cell: (v: Vehiculo) => labelVehiculoTipo(v.tipo),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          } : null,
          isVisible("detalle_vehiculo", "marca") ? {
            id: "marca",
            header: "Marca",
            cell: (v: Vehiculo) => v.marca ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          } : null,
          isVisible("detalle_vehiculo", "modelo") ? {
            id: "modelo",
            header: "Modelo",
            cell: (v: Vehiculo) => v.modelo ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          } : null,
          isVisible("detalle_vehiculo", "activo") ? {
            id: "estado",
            header: "Estado",
            cell: (v: Vehiculo) => (
              <span
                className={
                  v.activo
                    ? "text-xs uppercase tracking-wider text-emerald-800"
                    : "text-xs uppercase tracking-wider text-vialto-steel"
                }
              >
                {v.activo ? "Activo" : "Inactivo"}
              </span>
            ),
            tdClassName: listadoTablaTdClass,
          } : null,
        ].filter(Boolean) as any}
        rows={error ? [] : rows || []}
        rowKey={(v) => v.id}
        emptyMessage={
          error
            ? "No se pudieron cargar los vehículos."
            : activeFilterCount > 0
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
            {v.activo ? (
              <button
                type="button"
                onClick={() => void toggleActivo(v)}
                className={`${listadoTablaAccionClass} text-red-900 hover:bg-red-50`}
              >
                Desactivar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void toggleActivo(v)}
                className={`${listadoTablaAccionClass} text-emerald-900 hover:bg-emerald-50`}
              >
                Reactivar
              </button>
            )}
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
