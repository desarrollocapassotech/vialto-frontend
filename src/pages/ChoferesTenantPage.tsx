import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChoferViewModal } from "@/components/choferes/ChoferViewModal";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
<<<<<<< HEAD
=======
import { ListadoFiltroCampo } from "@/components/listado/ListadoFiltroCampo";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
>>>>>>> 6c7c97c21e4884630f198452435ca34f6c8534fa
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
import { ListadoPagination } from "@/components/listado/ListadoPagination";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { Chofer, PaginatedMeta } from "@/types/api";

type ChoferesPaginatedResponse = {
  items: Chofer[];
  meta: PaginatedMeta;
};

export function ChoferesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const maestro = useMaestroData();
  const hasCombustible = canAccessCombustible(maestro.tenant?.modules ?? []);
  const [rows, setRows] = useState<Chofer[] | null>(null);
  const [serverMeta, setServerMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingChoferId, setViewingChoferId] = useState<string | null>(null);
  const [viewingChoferNombre, setViewingChoferNombre] = useState("");
  const [confirmToggle, setConfirmToggle] = useState<Chofer | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

<<<<<<< HEAD
  // Estados de los filtros de columna
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroDni, setFiltroDni] = useState("");
  const [filtroLicencia, setFiltroLicencia] = useState("");

  function limpiarFiltros() {
    setFiltroNombre("");
    setFiltroDni("");
    setFiltroLicencia("");
    setPage(1);
  }

  const anyFiltroActivo = !!filtroNombre || !!filtroDni || !!filtroLicencia;

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
  const opcionesDni = useMemo(
    () =>
      Array.from(
        new Set((rows || []).map((r) => r.dni).filter((v): v is string => !!v)),
      ).sort(),
    [rows],
  );
  const opcionesLicencia = useMemo(
    () =>
      Array.from(
        new Set(
          (rows || []).map((r) => r.licencia).filter((v): v is string => !!v),
        ),
      ).sort(),
    [rows],
  );

  const rowsFiltradas = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (filtroNombre && r.nombre !== filtroNombre) return false;
      if (filtroDni && r.dni !== filtroDni) return false;
      if (filtroLicencia && r.licencia !== filtroLicencia) return false;
      return true;
    });
  }, [rows, filtroNombre, filtroDni, filtroLicencia]);
=======
  const [nombreFiltroInput, setNombreFiltroInput] = useState("");
  const [nombreFiltro, setNombreFiltro] = useState("");
  const [dniFiltroInput, setDniFiltroInput] = useState("");
  const [dniFiltro, setDniFiltro] = useState("");
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
    if (nombreFiltro) params.set("nombre", nombreFiltro);
    if (dniFiltro) params.set("dni", dniFiltro);
    const data = await apiJson<ChoferesPaginatedResponse>(
      `/api/choferes/paginated?${params.toString()}`,
      () => getToken(),
    );
    setRows(data.items);
    setMeta(data.meta);
  }, [
    getToken,
    isLoaded,
    isSignedIn,
    page,
    pageSize,
    nombreFiltro,
    dniFiltro,
    filtroActivo,
  ]);
>>>>>>> 6c7c97c21e4884630f198452435ca34f6c8534fa

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
<<<<<<< HEAD
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        const data = await apiJson<ChoferesPaginatedResponse>(
          `/api/choferes/paginated?${params.toString()}`,
          () => getToken(),
        );
        if (!cancelled) {
          setRows(data.items);
          setServerMeta(data.meta);
          setError(null);
        }
=======
        await load();
        if (!cancelled) setError(null);
>>>>>>> 6c7c97c21e4884630f198452435ca34f6c8534fa
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setServerMeta(null);
          setError(friendlyError(e, "choferes"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
<<<<<<< HEAD
  }, [getToken, isLoaded, isSignedIn, page, pageSize]);
=======
  }, [isLoaded, isSignedIn, load]);

  useEffect(() => {
    setPage(1);
  }, [nombreFiltro, dniFiltro, filtroActivo]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (nombreFiltro.trim()) n += 1;
    if (dniFiltro.trim()) n += 1;
    if (filtroActivo !== "todos") n += 1;
    return n;
  }, [nombreFiltro, dniFiltro, filtroActivo]);

  function limpiarFiltros() {
    setNombreFiltroInput("");
    setNombreFiltro("");
    setDniFiltroInput("");
    setDniFiltro("");
    setFiltroActivo("todos");
  }

  async function handleToggleActivo() {
    if (!confirmToggle) return;
    setError(null);
    setToggleBusy(true);
    try {
      await apiJson<Chofer>(
        `/api/choferes/${encodeURIComponent(confirmToggle.id)}`,
        () => getToken(),
        { method: "PATCH", body: JSON.stringify({ activo: !confirmToggle.activo }) },
      );
      setConfirmToggle(null);
      await load();
    } catch (e) {
      setError(friendlyError(e, "choferes"));
      setConfirmToggle(null);
    } finally {
      setToggleBusy(false);
    }
  }

  const estadoSelectClass = (activo: boolean) =>
    `h-9 w-full border border-black/15 bg-white px-2 text-sm ${
      activo ? "text-vialto-fire" : "text-vialto-charcoal"
    }`;

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
      <ListadoFiltroCampo label="Estado" active={filtroActivo !== "todos"}>
        <select
          value={filtroActivo}
          onChange={(e) =>
            setFiltroActivo(e.target.value as "todos" | "activos" | "inactivos")
          }
          className={estadoSelectClass(filtroActivo !== "todos")}
          aria-label="Filtrar por estado del chofer"
        >
          <option value="todos">Todos</option>
          <option value="activos">Solo activos</option>
          <option value="inactivos">Solo inactivos</option>
        </select>
      </ListadoFiltroCampo>
    </>
  );
>>>>>>> 6c7c97c21e4884630f198452435ca34f6c8534fa

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Choferes
      </h1>
<<<<<<< HEAD
      <p className="mt-2 text-vialto-steel">
        Quienes manejan tus unidades, con datos de contacto a mano.
      </p>

      <div className="mt-4 flex justify-end gap-2">
        {anyFiltroActivo && (
=======
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {activeFilterCount > 0 && (
>>>>>>> 6c7c97c21e4884630f198452435ca34f6c8534fa
          <button
            type="button"
            onClick={limpiarFiltros}
            className="hidden lg:inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
          >
            Limpiar filtros
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
        className="mt-6"
        tableColSpan={5}
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
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="DNI"
                filterActive={!!filtroDni}
                filterSignature={filtroDni}
              >
                <select
                  value={filtroDni}
                  onChange={(e) => {
                    setFiltroDni(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroDni ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por DNI"
                >
                  <option value="">Todos</option>
                  {opcionesDni.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
<<<<<<< HEAD
                title="Licencia"
                filterActive={!!filtroLicencia}
                filterSignature={filtroLicencia}
              >
                <select
                  value={filtroLicencia}
                  onChange={(e) => {
                    setFiltroLicencia(e.target.value);
                    setPage(1);
                  }}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroLicencia ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por Licencia"
                >
                  <option value="">Todas</option>
                  {opcionesLicencia.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Teléfono
=======
                title="Estado"
                filterActive={filtroActivo !== "todos"}
                filterSignature={filtroActivo}
              >
                <select
                  value={filtroActivo}
                  onChange={(e) =>
                    setFiltroActivo(
                      e.target.value as "todos" | "activos" | "inactivos",
                    )
                  }
                  className={estadoSelectClass(filtroActivo !== "todos")}
                  aria-label="Filtrar por estado del chofer"
                >
                  <option value="todos">Todos</option>
                  <option value="activos">Solo activos</option>
                  <option value="inactivos">Solo inactivos</option>
                </select>
              </ViajesListadoHeaderFiltro>
>>>>>>> 6c7c97c21e4884630f198452435ca34f6c8534fa
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
            id: "estado",
            header: "Estado",
            cell: (c) => (
              <span
                className={
                  c.activo
                    ? "text-xs uppercase tracking-wider text-emerald-800"
                    : "text-xs uppercase tracking-wider text-vialto-steel"
                }
              >
                {c.activo ? "Activo" : "Inactivo"}
              </span>
            ),
            tdClassName: listadoTablaTdClass,
          },
        ]}
        rows={error ? [] : rowsFiltradas}
        rowKey={(c) => c.id}
        emptyMessage={
          error
            ? "No se pudieron cargar los choferes."
            : anyFiltroActivo
              ? "No hay choferes que coincidan con los filtros aplicados."
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
            {c.activo ? (
              <button
                type="button"
                onClick={() => setConfirmToggle(c)}
                className={`${listadoTablaAccionClass} text-red-900 hover:bg-red-50`}
              >
                Desactivar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmToggle(c)}
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

      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.activo ? "Desactivar chofer" : "Reactivar chofer"}
        message={
          confirmToggle?.activo
            ? `¿Desactivar a "${confirmToggle?.nombre}"? No va a poder loguearse en la app de combustible hasta que lo reactives.`
            : `¿Reactivar a "${confirmToggle?.nombre}"?`
        }
        confirmLabel={confirmToggle?.activo ? "Desactivar" : "Reactivar"}
        tone={confirmToggle?.activo ? "danger" : "default"}
        busy={toggleBusy}
        onConfirm={handleToggleActivo}
        onCancel={() => setConfirmToggle(null)}
      />
    </div>
  );
}
