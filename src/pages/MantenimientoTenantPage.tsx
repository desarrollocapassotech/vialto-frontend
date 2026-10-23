import { useAuth, useUser } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ClipboardList, Gauge, ListChecks } from "lucide-react";
import {
  SelectorOpcionesSheet,
  selectorTriggerClass,
  type SelectorOpcion,
} from "@/components/ui/SelectorOpcionesSheet";
import { VencimientosSection } from "@/components/mantenimiento/VencimientosSection";
import { OrdenesTrabajoSection } from "@/components/mantenimiento/OrdenesTrabajoSection";
import { PlanesSection } from "@/components/mantenimiento/PlanesSection";
import { OrdenTrabajoModal, type OrdenModalEstado } from "@/components/mantenimiento/OrdenTrabajoModal";
import { MantenimientoOnboarding } from "@/components/mantenimiento/onboarding/MantenimientoOnboarding";
import { HistorialVehiculoModal } from "@/components/mantenimiento/HistorialVehiculoModal";
import { EditarKmVehiculoModal } from "@/components/combustible/EditarKmVehiculoModal";
import { useMaestroData } from "@/hooks/useMaestroData";
import { apiJson } from "@/lib/api";
import { mantUrl } from "@/lib/mantenimientoApi";
import { isOrgMember } from "@/lib/roleLabels";
import type { PlanMantenimiento, PrecargaOrden } from "@/types/mantenimiento";

type Tab = "vencimientos" | "ordenes" | "planes";

/** Sin planes: el admin ve el asistente de configuración inicial; el resto, un aviso. */
type Vista = "cargando" | "asistente" | "sin-configurar" | "pestanas";

const TABS: { id: Tab; label: string; icon: typeof Gauge }[] = [
  { id: "vencimientos", label: "Vencimientos", icon: Gauge },
  { id: "ordenes", label: "Órdenes de trabajo", icon: ClipboardList },
  { id: "planes", label: "Planes", icon: ListChecks },
];

/**
 * Mantenimiento de flota (ver vialto-backend/docs/mantenimiento-plan.md): semáforo de
 * vencimientos y órdenes de trabajo. `tenantId`/`embeddedInSuperadmin` siguen el patrón de las
 * demás pantallas para una futura vista de superadmin (hoy no hay ruta de superadmin).
 */
export function MantenimientoTenantPage({
  tenantId,
  embeddedInSuperadmin = false,
}: {
  tenantId?: string;
  embeddedInSuperadmin?: boolean;
} = {}) {
  const { getToken, orgRole } = useAuth();
  const { user } = useUser();
  const soloLectura = useMemo(
    () => !embeddedInSuperadmin && isOrgMember({ orgRole, publicMetadata: user?.publicMetadata }),
    [embeddedInSuperadmin, orgRole, user?.publicMetadata],
  );
  const token = useCallback(() => getToken(), [getToken]);

  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = TABS.some((t) => t.id === rawTab) ? (rawTab as Tab) : "vencimientos";
  const [sectionSheetOpen, setSectionSheetOpen] = useState(false);

  const [modal, setModal] = useState<OrdenModalEstado | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [limpiarFiltrosSlot, setLimpiarFiltrosSlot] =
    useState<HTMLDivElement | null>(null);
  const [accionesSlot, setAccionesSlot] = useState<HTMLDivElement | null>(null);
  const recargar = useCallback(() => setReloadKey((k) => k + 1), []);
  const maestro = useMaestroData();
  const [historialVehiculoId, setHistorialVehiculoId] = useState<string | null>(null);
  const [editarKmVehiculoId, setEditarKmVehiculoId] = useState<string | null>(null);
  const vehiculoEditarKm = editarKmVehiculoId ? maestro.vehiculos.find((v) => v.id === editarKmVehiculoId) : undefined;

  // Solo al entrar: una vez arrancado, el asistente sigue en pantalla aunque ya haya planes.
  const [vista, setVista] = useState<Vista>("cargando");
  useEffect(() => {
    let cancelado = false;
    apiJson<PlanMantenimiento[]>(mantUrl("planes", tenantId), () => token())
      .then((planes) => {
        if (cancelado) return;
        setVista(planes.length > 0 ? "pestanas" : soloLectura ? "sin-configurar" : "asistente");
      })
      .catch(() => !cancelado && setVista("pestanas"));
    return () => {
      cancelado = true;
    };
  }, [token, tenantId, soloLectura]);

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

  function salirDelAsistente() {
    setVista("pestanas");
    setTab("vencimientos");
    recargar();
  }

  const activeTabDef = TABS.find((t) => t.id === activeTab);
  const ActiveIcon = activeTabDef?.icon;
  const sectionOptions: SelectorOpcion[] = TABS.map((t) => ({ id: t.id, label: t.label }));

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide">Mantenimiento</h1>
        {/* Cada sección portalea acá sus filtros rápidos y su "Limpiar filtros" (como en Viajes). */}
        <div ref={setLimpiarFiltrosSlot} className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 empty:hidden" />
        {/* Acciones del título: la pestaña Planes pone las suyas por portal. */}
        <div ref={setAccionesSlot} className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {vista === "asistente" && (
            <button
              type="button"
              onClick={salirDelAsistente}
              className="text-xs text-vialto-steel hover:text-vialto-charcoal hover:underline"
            >
              Saltar y configurar a mano
            </button>
          )}
          {vista === "pestanas" && !soloLectura && activeTab !== "planes" && (
            <button
              type="button"
              onClick={() => setModal({ modo: "crear" })}
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
            >
              Nueva orden de trabajo
            </button>
          )}
        </div>
      </div>

      {vista === "cargando" && <p className="mt-6 text-sm text-vialto-steel">Cargando…</p>}
      {vista === "asistente" && (
        <MantenimientoOnboarding getToken={token} tenantId={tenantId} onTerminar={salirDelAsistente} />
      )}
      {vista === "sin-configurar" && (
        <div className="mx-auto mt-10 max-w-lg border border-dashed border-black/15 bg-white px-6 py-10 text-center">
          <p className="text-sm text-vialto-charcoal">Mantenimiento todavía no está configurado.</p>
          <p className="mt-1 text-sm text-vialto-steel">Pedile a un administrador de la empresa que lo configure.</p>
        </div>
      )}

      {vista === "pestanas" && (
        <>
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
                  {ActiveIcon && <ActiveIcon className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={1.75} aria-hidden />}
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

            <nav className="-mb-px hidden gap-1 overflow-x-auto lg:flex" aria-label="Secciones de mantenimiento">
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
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-6">
            {activeTab === "vencimientos" && (
              <VencimientosSection
                getToken={token}
                tenantId={tenantId}
                soloLectura={soloLectura}
                reloadKey={reloadKey}
                limpiarFiltrosSlot={limpiarFiltrosSlot}
                onRegistrarService={(precarga: PrecargaOrden) => setModal({ modo: "crear", precarga })}
                onIrAPlanes={() => setTab("planes")}
                onHistorial={setHistorialVehiculoId}
                onEditarKm={setEditarKmVehiculoId}
              />
            )}
            {activeTab === "ordenes" && (
              <OrdenesTrabajoSection
                getToken={token}
                tenantId={tenantId}
                soloLectura={soloLectura}
                reloadKey={reloadKey}
                limpiarFiltrosSlot={limpiarFiltrosSlot}
                onVer={(ordenId) => setModal({ modo: "ver", ordenId })}
                onHistorial={setHistorialVehiculoId}
                onCambio={recargar}
              />
            )}
            {activeTab === "planes" && (
              <PlanesSection
                getToken={token}
                tenantId={tenantId}
                soloLectura={soloLectura}
                reloadKey={reloadKey}
                limpiarFiltrosSlot={limpiarFiltrosSlot}
                accionesSlot={accionesSlot}
                onCambio={recargar}
              />
            )}
          </div>
        </>
      )}

      {historialVehiculoId && (
        <HistorialVehiculoModal
          vehiculoId={historialVehiculoId}
          soloLectura={soloLectura}
          getToken={token}
          tenantId={tenantId}
          onClose={() => setHistorialVehiculoId(null)}
          onVerOrden={(ordenId) => setModal({ modo: "ver", ordenId })}
          onCambio={() => {
            void maestro.refreshVehiculos();
            recargar();
          }}
        />
      )}
      {vehiculoEditarKm && (
        <EditarKmVehiculoModal
          url={`/api/vehiculos/${encodeURIComponent(vehiculoEditarKm.id)}/km${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}
          vehiculoId={vehiculoEditarKm.id}
          patente={vehiculoEditarKm.patente}
          kmActual={vehiculoEditarKm.kmActual}
          onClose={() => setEditarKmVehiculoId(null)}
          onSuccess={() => {
            setEditarKmVehiculoId(null);
            void maestro.refreshVehiculos();
            recargar();
          }}
        />
      )}

      {modal && (
        <OrdenTrabajoModal
          estado={modal}
          soloLectura={soloLectura}
          getToken={token}
          tenantId={tenantId}
          onClose={() => setModal(null)}
          onGuardada={recargar}
        />
      )}
    </div>
  );
}
