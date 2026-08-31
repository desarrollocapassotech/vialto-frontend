import { useAuth, useUser } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, TriangleAlert, Wrench } from "lucide-react";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  SelectorOpcionesSheet,
  selectorTriggerClass,
  type SelectorOpcion,
} from "@/components/ui/SelectorOpcionesSheet";
import { IntervencionModal } from "@/components/mantenimiento/IntervencionModal";
import { MantenimientoAlertasSection } from "@/components/mantenimiento/MantenimientoAlertasSection";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { filtrarVehiculos } from "@/components/forms/maestroSearchFilters";
import { useMaestroData } from "@/hooks/useMaestroData";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import {
  listadoTablaAccionClass,
  listadoTablaHeadRowClass,
  listadoTablaTdClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import {
  fmtFechaIntervencion,
  fmtKm,
  fmtTipoIntervencion,
  fmtTiposIntervencion,
} from "@/lib/mantenimientoLabels";
import { calcularAlertasMantenimiento } from "@/lib/mantenimientoAlertas";
import { isOrgMember } from "@/lib/roleLabels";
import type { Intervencion, Vehiculo } from "@/types/api";

type Tab = "intervenciones" | "alertas";

const TABS: { id: Tab; label: string; icon: typeof Wrench }[] = [
  { id: "intervenciones", label: "Intervenciones", icon: Wrench },
  { id: "alertas", label: "Alertas", icon: TriangleAlert },
];

export function MantenimientoTenantPage() {
  const { getToken, isLoaded, isSignedIn, orgRole } = useAuth();
  const { user } = useUser();
  const { showToast } = useToast();
  const maestro = useMaestroData();

  const isReadOnly = useMemo(
    () => isOrgMember({ orgRole, publicMetadata: user?.publicMetadata }),
    [orgRole, user?.publicMetadata],
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : "intervenciones";
  const [sectionSheetOpen, setSectionSheetOpen] = useState(false);

  const [vehiculoIdFiltro, setVehiculoIdFiltro] = useState(
    searchParams.get("vehiculoId") ?? "",
  );
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [fechaDesdeFiltro, setFechaDesdeFiltro] = useState("");
  const [fechaHastaFiltro, setFechaHastaFiltro] = useState("");

  const [intervenciones, setIntervenciones] = useState<Intervencion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [modal, setModal] = useState<
    | { mode: "create" }
    | { mode: "view" | "edit"; intervencion: Intervencion }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<Intervencion | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Se traen siempre TODAS las intervenciones (sin filtrar por vehículo en el
  // servidor) para que la pestaña de Alertas nunca dependa del filtro elegido
  // en Intervenciones; el filtro de esa pestaña se aplica en el cliente.
  const load = useCallback(async () => {
    return apiJson<Intervencion[]>(
      "/api/mantenimiento/intervenciones",
      () => getToken(),
    );
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setIntervenciones(null);
    (async () => {
      try {
        const data = await load();
        if (!cancelled) {
          setIntervenciones(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setIntervenciones([]);
          setError(friendlyError(e, "mantenimiento"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, load, reloadKey]);

  const hayFiltrosIntervenciones =
    !!vehiculoIdFiltro ||
    !!tipoFiltro.trim() ||
    !!fechaDesdeFiltro ||
    !!fechaHastaFiltro;

  const intervencionesFiltradas = useMemo(() => {
    if (!hayFiltrosIntervenciones) return intervenciones;
    const tipoQuery = tipoFiltro.trim().toLowerCase();
    return (intervenciones ?? []).filter((i) => {
      if (vehiculoIdFiltro && i.vehiculoId !== vehiculoIdFiltro) return false;
      if (
        tipoQuery &&
        !fmtTiposIntervencion(i.tipos).toLowerCase().includes(tipoQuery)
      )
        return false;
      const fechaValor = i.fecha.slice(0, 10);
      if (fechaDesdeFiltro && fechaValor < fechaDesdeFiltro) return false;
      if (fechaHastaFiltro && fechaValor > fechaHastaFiltro) return false;
      return true;
    });
  }, [
    intervenciones,
    vehiculoIdFiltro,
    tipoFiltro,
    fechaDesdeFiltro,
    fechaHastaFiltro,
    hayFiltrosIntervenciones,
  ]);

  const alertas = useMemo(
    () => calcularAlertasMantenimiento(maestro.vehiculos, intervenciones ?? []),
    [maestro.vehiculos, intervenciones],
  );

  function setTab(tab: Tab) {
    setSearchParams(
      (prev) => {
        const qs = new URLSearchParams(prev);
        qs.set("tab", tab);
        return qs;
      },
      { replace: true },
    );
    setSectionSheetOpen(false);
  }

  function handleVehiculoFiltroChange(v: string) {
    setVehiculoIdFiltro(v);
    setSearchParams(
      (prev) => {
        const qs = new URLSearchParams(prev);
        if (v) qs.set("vehiculoId", v);
        else qs.delete("vehiculoId");
        return qs;
      },
      { replace: true },
    );
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiJson<{ deleted: string }>(
        `/api/mantenimiento/intervenciones/${encodeURIComponent(deleteTarget.id)}`,
        () => getToken(),
        { method: "DELETE" },
      );
      showToast("Intervención eliminada correctamente", "success");
      setDeleteTarget(null);
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast(friendlyError(e, "mantenimiento"), "error");
    } finally {
      setDeleting(false);
    }
  }

  const vehiculoOptions = maestro.vehiculos.filter((v) => v.activo);
  const activeTabDef = TABS.find((t) => t.id === activeTab);
  const ActiveIcon = activeTabDef?.icon;
  const sectionOptions: SelectorOpcion[] = TABS.map((t) => ({
    id: t.id,
    label: t.label,
  }));

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Mantenimiento
      </h1>

      <div className="mt-6 border-b border-black/15">
        <div className="pb-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSectionSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sectionSheetOpen}
            className={selectorTriggerClass}
          >
            <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
              Sección
            </span>
            <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
              {ActiveIcon && (
                <ActiveIcon
                  className="h-4 w-4 shrink-0 text-vialto-steel"
                  strokeWidth={1.75}
                  aria-hidden
                />
              )}
              <span className="truncate font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-vialto-charcoal">
                {activeTabDef?.label}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={2} aria-hidden />
            </span>
          </button>
          <SelectorOpcionesSheet
            open={sectionSheetOpen}
            onClose={() => setSectionSheetOpen(false)}
            title="Elegir sección"
            options={sectionOptions}
            activeId={activeTab}
            onSelect={(id) => setTab(id as Tab)}
          />
        </div>

        <nav
          className="-mb-px hidden gap-1 overflow-x-auto lg:flex"
          aria-label="Secciones de mantenimiento"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={[
                "flex shrink-0 whitespace-nowrap items-center gap-2 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] rounded-t-sm transition-colors border",
                activeTab === tab.id
                  ? "border-black/15 border-t-2 border-t-vialto-fire border-b-vialto-mist bg-vialto-mist text-vialto-charcoal"
                  : "border-transparent text-vialto-steel hover:text-vialto-charcoal hover:bg-black/[0.04]",
              ].join(" ")}
            >
              <tab.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              {tab.label}
              {tab.id === "alertas" && alertas.length > 0 && (
                <span className="inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-vialto-fire px-1 font-[family-name:var(--font-ui)] text-[10px] font-semibold tabular-nums leading-none text-white">
                  {alertas.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === "intervenciones" && (
          <>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setModal({ mode: "create" })}
                  className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
                >
                  Nueva intervención
                </button>
              )}
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            )}

            <ListadoDatos<Intervencion>
              className="mt-6"
              tableColSpan={7}
              tableHead={
                <tr className={listadoTablaHeadRowClass}>
                  <th scope="col" className={`${listadoTablaThClass} align-top`}>
                    <ViajesListadoHeaderFiltro
                      title="Vehículo"
                      filterActive={!!vehiculoIdFiltro}
                      filterSignature={vehiculoIdFiltro}
                    >
                      <SearchableEntitySelect<Vehiculo>
                        id="mantenimiento-filtro-vehiculo"
                        items={vehiculoOptions}
                        value={vehiculoIdFiltro}
                        onChange={(id) => handleVehiculoFiltroChange(id)}
                        filterItems={filtrarVehiculos}
                        getPrimaryLabel={(v) => v.patente}
                        getSecondaryLabel={(v) =>
                          [v.marca, v.modelo].filter(Boolean).join(" · ") || null
                        }
                        placeholderCerrado="Todos"
                        placeholderBuscar="Buscar patente o marca…"
                        searchAriaLabel="Filtrar vehículos"
                        allowEmptyValue
                        emptyListChoiceLabel="Todos"
                        aria-label="Filtrar por vehículo"
                        inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                          vehiculoIdFiltro ? "text-vialto-fire" : "text-vialto-charcoal"
                        }`}
                      />
                    </ViajesListadoHeaderFiltro>
                  </th>
                  <th scope="col" className={`${listadoTablaThClass} align-top`}>
                    <ViajesListadoHeaderFiltro
                      title="Tipo"
                      filterActive={!!tipoFiltro.trim()}
                      filterSignature={tipoFiltro}
                    >
                      <input
                        type="text"
                        value={tipoFiltro}
                        onChange={(e) => setTipoFiltro(e.target.value)}
                        placeholder="Buscar tipo…"
                        className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                          tipoFiltro.trim() ? "text-vialto-fire" : "text-vialto-charcoal"
                        }`}
                        aria-label="Filtrar por tipo"
                      />
                    </ViajesListadoHeaderFiltro>
                  </th>
                  <th scope="col" className={`${listadoTablaThClass} align-top`}>
                    <ViajesListadoHeaderFiltro
                      title="Fecha de intervención"
                      filterActive={!!fechaDesdeFiltro || !!fechaHastaFiltro}
                      filterSignature={`${fechaDesdeFiltro}|${fechaHastaFiltro}`}
                    >
                      <div className="flex flex-col gap-2">
                        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                          Desde
                          <input
                            type="date"
                            value={fechaDesdeFiltro}
                            onChange={(e) => setFechaDesdeFiltro(e.target.value)}
                            className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wider text-vialto-steel">
                          Hasta
                          <input
                            type="date"
                            value={fechaHastaFiltro}
                            onChange={(e) => setFechaHastaFiltro(e.target.value)}
                            className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                          />
                        </label>
                      </div>
                    </ViajesListadoHeaderFiltro>
                  </th>
                  <th scope="col" className={listadoTablaThClass}>Km</th>
                  <th scope="col" className={listadoTablaThClass}>Próximo km</th>
                  <th scope="col" className={listadoTablaThClass}>Vencimiento</th>
                  <th scope="col" className={`${listadoTablaThClass} text-right`}>Acciones</th>
                </tr>
              }
              columns={[
                {
                  id: "vehiculo",
                  header: "Vehículo",
                  primary: true,
                  cell: (r) =>
                    maestro.vehiculos.find((v) => v.id === r.vehiculoId)?.patente ??
                    r.vehiculoId,
                },
                {
                  id: "tipo",
                  header: "Tipo",
                  cell: (r) => {
                    const labels = r.tipos.map(fmtTipoIntervencion);
                    const visibles = labels.slice(0, 2);
                    const restantes = labels.length - visibles.length;
                    return (
                      <span>
                        {visibles.join(", ")}
                        {restantes > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModal({ mode: "view", intervencion: r });
                            }}
                            className="ml-1 text-xs font-medium text-vialto-fire hover:underline"
                          >
                            +{restantes}
                          </button>
                        )}
                      </span>
                    );
                  },
                },
                {
                  id: "fecha",
                  header: "Fecha de intervención",
                  cell: (r) => fmtFechaIntervencion(r.fecha),
                },
                { id: "km", header: "Km", cell: (r) => fmtKm(r.km) },
                {
                  id: "proximoKm",
                  header: "Próximo km",
                  cell: (r) => fmtKm(r.proximoKm),
                },
                {
                  id: "proximaFecha",
                  header: "Vencimiento",
                  cell: (r) =>
                    r.proximaFecha ? fmtFechaIntervencion(r.proximaFecha) : "—",
                },
              ]}
              rows={error ? [] : intervencionesFiltradas}
              rowKey={(r) => r.id}
              onRowClick={(r) => setModal({ mode: "view", intervencion: r })}
              emptyMessage={
                error
                  ? "No se pudieron cargar las intervenciones."
                  : hayFiltrosIntervenciones
                    ? "No hay intervenciones que coincidan con los filtros aplicados."
                    : "Todavía no hay intervenciones cargadas."
              }
              loadingMessage="Cargando…"
              actionsTdClassName={listadoTablaTdClass}
              renderActions={(r) => (
                <div className="inline-flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "view", intervencion: r })}
                    className={listadoTablaAccionClass}
                  >
                    Ver
                  </button>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(r)}
                      className={`${listadoTablaAccionClass} text-red-900 hover:bg-red-50`}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              )}
            />
          </>
        )}

        {activeTab === "alertas" && (
          <MantenimientoAlertasSection
            vehiculos={maestro.vehiculos}
            intervenciones={intervenciones ?? []}
          />
        )}
      </div>

      {modal && (
        <IntervencionModal
          modo={modal.mode}
          intervencionInicial={modal.mode === "create" ? undefined : modal.intervencion}
          vehiculos={maestro.vehiculos}
          vehiculoIdFiltro={vehiculoIdFiltro || undefined}
          getToken={getToken}
          onClose={() => setModal(null)}
          onEdit={
            modal.mode === "view"
              ? () => setModal({ mode: "edit", intervencion: modal.intervencion })
              : undefined
          }
          onSaved={() => {
            setModal(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar intervención"
        message="¿Seguro que querés eliminar esta intervención? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        tone="danger"
        busy={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
