import { useAuth } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChoferViewModal } from "@/components/choferes/ChoferViewModal";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ListadoFiltroCampo } from "@/components/listado/ListadoFiltroCampo";
import { useMaestroData } from "@/hooks/useMaestroData";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import {
  listadoTablaAccionClass,
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { canAccessCombustible } from "@/lib/tenantModules";
import type { Chofer, PaginatedMeta } from "@/types/api";
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";

type ChoferesPaginatedResponse = {
  items: Chofer[];
  meta: PaginatedMeta;
};

export function ChoferesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const maestro = useMaestroData();
  const hasCombustible = canAccessCombustible(maestro.tenant?.modules ?? []);
  const [rows, setRows] = useState<Chofer[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingChoferId, setViewingChoferId] = useState<string | null>(null);
  const [viewingChoferNombre, setViewingChoferNombre] = useState("");

  const [nombreFiltroInput, setNombreFiltroInput] = useState("");
  const [nombreFiltro, setNombreFiltro] = useState("");
  const [dniFiltroInput, setDniFiltroInput] = useState("");
  const [dniFiltro, setDniFiltro] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (nombreFiltro) params.set("nombre", nombreFiltro);
        if (dniFiltro) params.set("dni", dniFiltro);
        const data = await apiJson<ChoferesPaginatedResponse>(
          `/api/choferes/paginated?${params.toString()}`,
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
          setError(friendlyError(e, "choferes"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, page, pageSize, nombreFiltro, dniFiltro]);

  useEffect(() => {
    setPage(1);
  }, [nombreFiltro, dniFiltro]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (nombreFiltro.trim()) n += 1;
    if (dniFiltro.trim()) n += 1;
    return n;
  }, [nombreFiltro, dniFiltro]);

  function limpiarFiltros() {
    setNombreFiltroInput("");
    setNombreFiltro("");
    setDniFiltroInput("");
    setDniFiltro("");
  }

  const choferesListadoFiltros = (
    <>
      <ListadoFiltroCampo label="Nombre" active={!!nombreFiltro.trim()}>
        <div className="flex gap-1">
          <input
            type="text"
            value={nombreFiltroInput}
            onChange={(e) => setNombreFiltroInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setNombreFiltro(nombreFiltroInput.trim());
            }}
            placeholder="Buscar…"
            className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
              nombreFiltro.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
            }`}
            aria-label="Filtrar por nombre de chofer"
          />
          <button
            type="button"
            onClick={() => setNombreFiltro(nombreFiltroInput.trim())}
            className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
          >
            OK
          </button>
        </div>
      </ListadoFiltroCampo>
      <ListadoFiltroCampo label="DNI" active={!!dniFiltro.trim()}>
        <div className="flex gap-1">
          <input
            type="text"
            value={dniFiltroInput}
            onChange={(e) => setDniFiltroInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setDniFiltro(dniFiltroInput.trim());
            }}
            placeholder="Buscar…"
            className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
              dniFiltro.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
            }`}
            aria-label="Filtrar por DNI de chofer"
          />
          <button
            type="button"
            onClick={() => setDniFiltro(dniFiltroInput.trim())}
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
        Choferes
      </h1>
      <p className="mt-2 text-vialto-steel">
        Quienes manejan tus unidades, con datos de contacto a mano.
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
          to="/choferes/nuevo"
          className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
        >
          Crear chofer
        </Link>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      <ListadoDatos
        className="mt-8"
        filters={choferesListadoFiltros}
        activeFilterCount={activeFilterCount}
        onClearFilters={limpiarFiltros}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Nombre"
                filterActive={!!nombreFiltro.trim()}
                filterSignature={nombreFiltro}
              >
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={nombreFiltroInput}
                    onChange={(e) => setNombreFiltroInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        setNombreFiltro(nombreFiltroInput.trim());
                    }}
                    placeholder="Buscar…"
                    className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
                      nombreFiltro.trim()
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar por nombre de chofer"
                  />
                  <button
                    type="button"
                    onClick={() => setNombreFiltro(nombreFiltroInput.trim())}
                    className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    OK
                  </button>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="DNI"
                filterActive={!!dniFiltro.trim()}
                filterSignature={dniFiltro}
              >
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={dniFiltroInput}
                    onChange={(e) => setDniFiltroInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        setDniFiltro(dniFiltroInput.trim());
                    }}
                    placeholder="Buscar…"
                    className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
                      dniFiltro.trim()
                        ? "text-vialto-fire"
                        : "text-vialto-charcoal"
                    }`}
                    aria-label="Filtrar por DNI de chofer"
                  />
                  <button
                    type="button"
                    onClick={() => setDniFiltro(dniFiltroInput.trim())}
                    className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    OK
                  </button>
                </div>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              Licencia
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              Teléfono
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
            id: "nombre",
            header: "Nombre",
            primary: true,
            cell: (c) => c.nombre,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
          {
            id: "dni",
            header: "DNI",
            cell: (c) => c.dni ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "licencia",
            header: "Licencia",
            cell: (c) => c.licencia ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
          {
            id: "telefono",
            header: "Teléfono",
            cell: (c) => c.telefono ?? "—",
            tdClassName: `${listadoTablaTdClass} text-vialto-steel`,
          },
        ]}
        rows={error ? [] : rows}
        rowKey={(c) => c.id}
        emptyMessage={
          error
            ? "No se pudieron cargar los choferes."
            : activeFilterCount > 0
              ? "No hay choferes que coincidan con el criterio."
              : "Todavía no tenés choferes cargados."
        }
        loadingMessage="Cargando…"
        renderActions={(c) => (
          <div className="inline-flex gap-2">
            <button
              type="button"
              onClick={() => {
                setViewingChoferId(c.id);
                setViewingChoferNombre(c.nombre);
              }}
              className={listadoTablaAccionClass}
            >
              Ver
            </button>
            <Link
              to={`/choferes/${encodeURIComponent(c.id)}/editar`}
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

      {viewingChoferId && (
        <ChoferViewModal
          choferId={viewingChoferId}
          nombreTitulo={viewingChoferNombre}
          showPin={hasCombustible}
          onClose={() => {
            setViewingChoferId(null);
            setViewingChoferNombre("");
          }}
          editTo={`/choferes/${encodeURIComponent(viewingChoferId)}/editar`}
        />
      )}
    </div>
  );
}
