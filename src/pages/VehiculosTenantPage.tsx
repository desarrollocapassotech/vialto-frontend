import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoFiltroCampo } from "@/components/listado/ListadoFiltroCampo";
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
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingVehiculoId, setViewingVehiculoId] = useState<string | null>(
    null,
  );
  const [viewingVehiculoPatente, setViewingVehiculoPatente] = useState("");

  const [patenteFiltroInput, setPatenteFiltroInput] = useState("");
  const [patenteFiltro, setPatenteFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [marcaFiltroInput, setMarcaFiltroInput] = useState("");
  const [marcaFiltro, setMarcaFiltro] = useState("");
  const [modeloFiltroInput, setModeloFiltroInput] = useState("");
  const [modeloFiltro, setModeloFiltro] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (patenteFiltro) params.set("patente", patenteFiltro);
        if (tipoFiltro) params.set("tipo", tipoFiltro);
        if (marcaFiltro) params.set("marca", marcaFiltro);
        if (modeloFiltro) params.set("modelo", modeloFiltro);
        const data = await apiJson<VehiculosPaginatedResponse>(
          `/api/vehiculos/paginated?${params.toString()}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data.items);
          setMeta(data.meta);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setMeta(null);
          setError(friendlyError(e, "vehiculos"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    getToken,
    isLoaded,
    isSignedIn,
    page,
    pageSize,
    patenteFiltro,
    tipoFiltro,
    marcaFiltro,
    modeloFiltro,
  ]);

  useEffect(() => {
    setPage(1);
  }, [patenteFiltro, tipoFiltro, marcaFiltro, modeloFiltro]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (patenteFiltro.trim()) n += 1;
    if (tipoFiltro) n += 1;
    if (marcaFiltro.trim()) n += 1;
    if (modeloFiltro.trim()) n += 1;
    return n;
  }, [patenteFiltro, tipoFiltro, marcaFiltro, modeloFiltro]);

  function limpiarFiltros() {
    setPatenteFiltroInput("");
    setPatenteFiltro("");
    setTipoFiltro("");
    setMarcaFiltroInput("");
    setMarcaFiltro("");
    setModeloFiltroInput("");
    setModeloFiltro("");
  }

  const tipoSelectClass = (activo: boolean) =>
    `h-9 w-full border border-black/15 bg-white px-2 text-sm ${
      activo ? "text-vialto-fire" : "text-vialto-charcoal"
    }`;

  const vehiculosListadoFiltros = (
    <>
      <ListadoFiltroCampo label="Patente" active={!!patenteFiltro.trim()}>
        <div className="flex gap-1">
          <input
            type="text"
            value={patenteFiltroInput}
            onChange={(e) => setPatenteFiltroInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                setPatenteFiltro(patenteFiltroInput.trim());
            }}
            placeholder="Buscar…"
            className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 font-mono text-sm ${
              patenteFiltro.trim()
                ? "text-vialto-fire"
                : "text-vialto-charcoal"
            }`}
            aria-label="Filtrar por patente"
          />
          <button
            type="button"
            onClick={() => setPatenteFiltro(patenteFiltroInput.trim())}
            className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
          >
            OK
          </button>
        </div>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Tipo" active={!!tipoFiltro}>
        <select
          value={tipoFiltro}
          onChange={(e) => setTipoFiltro(e.target.value)}
          className={tipoSelectClass(!!tipoFiltro)}
          aria-label="Filtrar por tipo de vehículo"
        >
          {TIPO_OPCIONES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Marca" active={!!marcaFiltro.trim()}>
        <div className="flex gap-1">
          <input
            type="text"
            value={marcaFiltroInput}
            onChange={(e) => setMarcaFiltroInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setMarcaFiltro(marcaFiltroInput.trim());
            }}
            placeholder="Buscar…"
            className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
              marcaFiltro.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
            }`}
            aria-label="Filtrar por marca"
          />
          <button
            type="button"
            onClick={() => setMarcaFiltro(marcaFiltroInput.trim())}
            className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
          >
            OK
          </button>
        </div>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="Modelo" active={!!modeloFiltro.trim()}>
        <div className="flex gap-1">
          <input
            type="text"
            value={modeloFiltroInput}
            onChange={(e) => setModeloFiltroInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                setModeloFiltro(modeloFiltroInput.trim());
            }}
            placeholder="Buscar…"
            className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
              modeloFiltro.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
            }`}
            aria-label="Filtrar por modelo"
          />
          <button
            type="button"
            onClick={() => setModeloFiltro(modeloFiltroInput.trim())}
            className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
          >
            OK
          </button>
        </div>
      </ListadoFiltroCampo>
    </>
  );

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
            className="hidden h-10 items-center gap-2 px-4 border border-black/15 bg-white text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors lg:inline-flex"
          >
            Limpiar filtros
            <span
              className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-vialto-fire px-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold tabular-nums leading-none text-white"
              aria-hidden
            >
              {activeFilterCount}
            </span>
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
        className="mt-8"
        filters={vehiculosListadoFiltros}
        activeFilterCount={activeFilterCount}
        onClearFilters={limpiarFiltros}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Patente"
                filterActive={!!patenteFiltro.trim()}
                filterSignature={patenteFiltro}
              >
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={patenteFiltroInput}
                    onChange={(e) => setPatenteFiltroInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        setPatenteFiltro(patenteFiltroInput.trim());
                    }}
                    placeholder="Buscar…"
                    className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 font-mono text-sm ${
                      patenteFiltro.trim()
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar por patente"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPatenteFiltro(patenteFiltroInput.trim())
                    }
                    className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    OK
                  </button>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Tipo"
                filterActive={!!tipoFiltro}
                filterSignature={tipoFiltro}
              >
                <select
                  value={tipoFiltro}
                  onChange={(e) => setTipoFiltro(e.target.value)}
                  className={tipoSelectClass(!!tipoFiltro)}
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
                filterActive={!!marcaFiltro.trim()}
                filterSignature={marcaFiltro}
              >
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={marcaFiltroInput}
                    onChange={(e) => setMarcaFiltroInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        setMarcaFiltro(marcaFiltroInput.trim());
                    }}
                    placeholder="Buscar…"
                    className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
                      marcaFiltro.trim()
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar por marca"
                  />
                  <button
                    type="button"
                    onClick={() => setMarcaFiltro(marcaFiltroInput.trim())}
                    className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    OK
                  </button>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Modelo"
                filterActive={!!modeloFiltro.trim()}
                filterSignature={modeloFiltro}
              >
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={modeloFiltroInput}
                    onChange={(e) => setModeloFiltroInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        setModeloFiltro(modeloFiltroInput.trim());
                    }}
                    placeholder="Buscar…"
                    className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
                      modeloFiltro.trim()
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar por modelo"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setModeloFiltro(modeloFiltroInput.trim())
                    }
                    className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    OK
                  </button>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
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
        rows={error ? [] : rows}
        rowKey={(v) => v.id}
        emptyMessage={
          error
            ? "No se pudieron cargar los vehículos."
            : activeFilterCount > 0
              ? "No hay vehículos que coincidan con el criterio."
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

      {meta && (
        <div className="mt-4">
          <ListadoPagination
            meta={meta}
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
