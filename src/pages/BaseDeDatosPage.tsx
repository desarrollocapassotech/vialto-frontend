import { useState } from "react";
import { useTransportistaLabels } from "@/hooks/useTransportistaLabels";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import {
  Car,
  ChevronDown,
  Globe,
  Layers,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
  Upload,
  UserCheck,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import {
  SelectorOpcionesSheet,
  selectorTriggerClass,
  type SelectorOpcion,
} from "@/components/ui/SelectorOpcionesSheet";
import { ClientesPage } from "./ClientesPage";
import { TransportistasPage } from "./TransportistasPage";
import { ChoferesPage } from "./ChoferesPage";
import { DestinatariosPage } from "./DestinatariosPage";
import { VehiculosPage } from "./VehiculosPage";
import { ProductosPage } from "./ProductosPage";
import { DepositosPage } from "./DepositosPage";
import { PresentacionesPage } from "./PresentacionesPage";
import { SuperadminUsersPage } from "./SuperadminUsersPage";
import { UsuariosTenantPage } from "./UsuariosTenantPage";
import { DireccionesEntregaPage } from "./DireccionesEntregaPage";
import { PaisesPage } from "./PaisesPage";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useProductoLabels } from "@/hooks/useProductoLabels";
import { useTipoFlotaVisible } from "@/hooks/useTipoFlotaVisible";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import {
  canAccessViajes,
  canAccessStock,
  canAccessFacturacion,
  canAccessEmisionFacturasArca,
  canAccessCombustible,
} from "@/lib/tenantModules";
import {
  isPlatformSuperadmin,
  isOrgAdmin as userIsOrgAdmin,
} from "@/lib/roleLabels";
import { useAuth } from "@clerk/clerk-react";

type Tab =
  | "clientes"
  | "transportistas"
  | "choferes"
  | "destinatarios"
  | "vehiculos"
  | "productos"
  | "presentaciones"
  | "depositos"
  | "direcciones-entrega"
  | "paises"
  | "usuarios"
  | "importar";

const ALL_TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "transportistas", label: "Transportistas", icon: Truck },
  { id: "choferes", label: "Choferes", icon: UserCheck },
  { id: "destinatarios", label: "Destinatarios", icon: MapPin },
  { id: "vehiculos", label: "Vehículos", icon: Car },
  { id: "productos", label: "Productos", icon: Package },
  { id: "presentaciones", label: "Presentaciones", icon: Layers },
  { id: "depositos", label: "Depósitos", icon: Warehouse },
  {
    id: "direcciones-entrega",
    label: "Direcciones / Ruta de entrega",
    icon: MapPin,
  },
  { id: "paises", label: "Países", icon: Globe },
  { id: "usuarios", label: "Usuarios", icon: ShieldCheck },
  { id: "importar", label: "Importar datos", icon: Upload },
];

/** Módulo al que pertenece cada sección, para agruparlas en el menú. */
type GrupoTab = "general" | "viajes" | "stock" | "administracion";
const GRUPOS: { id: GrupoTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "viajes", label: "Viajes" },
  { id: "stock", label: "Stock" },
  { id: "administracion", label: "Administración" },
];
function grupoDeTab(tab: Tab, conStock: boolean): GrupoTab {
  switch (tab) {
    case "clientes":
      return "general";
    case "transportistas":
    case "choferes":
    case "vehiculos":
    case "paises":
      return "viajes";
    // Productos es el catálogo de Stock si la empresa lo tiene; si no, la carga de Viajes.
    case "productos":
      return conStock ? "stock" : "viajes";
    case "destinatarios":
    case "presentaciones":
    case "depositos":
    case "direcciones-entrega":
      return "stock";
    default:
      return "administracion";
  }
}

export function BaseDeDatosPage() {
  const { user, isLoaded } = useUser();
  const { orgRole } = useAuth();
  const { tenant, loading: tenantLoading } = useCurrentTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { flotaPropiaVisible, transportistaExternoVisible } =
    useTipoFlotaVisible();
  const hasAlgunaPertenenciaChofer =
    flotaPropiaVisible || transportistaExternoVisible;
  const { isVisible: isViajesFieldVisible } = useFieldConfig("viajes");

  const superadmin = isLoaded && isPlatformSuperadmin(user?.publicMetadata);
  const tabsLoading = !isLoaded || tenantLoading;
  const modules = tenant?.modules ?? [];
  const hasViajes = superadmin || canAccessViajes(modules);
  const hasStock = superadmin || canAccessStock(modules);
  const hasFacturacion =
    superadmin ||
    canAccessFacturacion(modules) ||
    canAccessEmisionFacturasArca(modules);
  const hasCombustible = superadmin || canAccessCombustible(modules);
  const isOrgAdmin =
    superadmin ||
    userIsOrgAdmin({ orgRole, publicMetadata: user?.publicMetadata });

  const productoLabelsTenant = useProductoLabels();
  // Nombre que la empresa le da al transportista (superadmin): pestaña "Fleteros", etc.
  const transportistaLabelsTenant = useTransportistaLabels();
  // Con Stock la pestaña es el catálogo de Stock: siempre "Productos". El label
  // propio de la empresa (ej. "Cargas") solo aplica si no tiene Stock.
  const visibleTabs = ALL_TABS.map((tab) =>
    tab.id === "productos" && !canAccessStock(modules)
      ? { ...tab, label: productoLabelsTenant.plural }
      : tab.id === "transportistas"
        ? { ...tab, label: transportistaLabelsTenant.plural }
        : tab,
  ).filter((tab) => {
    switch (tab.id) {
      case "clientes":
        return hasViajes || hasStock || hasFacturacion;
      case "transportistas":
        // Empresa solo de flota propia (superadmin deshabilitó la opción
        // "Transportista externo" del chofer): no trabaja con transportistas.
        return hasViajes && (superadmin || transportistaExternoVisible);
      case "vehiculos":
        // Superadmin apagó "Vehículos" (Configuración por empresa → General,
        // campo `vehiculosRows` de Viajes): la empresa no trabaja con vehículos.
        return (
          (hasViajes || hasCombustible) &&
          (superadmin || isViajesFieldVisible("alta_viaje", "vehiculosRows"))
        );
      case "destinatarios":
        return hasStock;
      case "choferes":
        // Si el superadmin deshabilitó las 2 opciones de pertenencia (Flota
        // propia / Transportista externo — ver Configuración por empresa), no
        // se puede crear ningún chofer: no tiene sentido dejar la pestaña.
        // Además, sin Combustible ni Stock (que siempre usan choferes), depende
        // del switch "Choferes" (Configuración por empresa → General, campos
        // `choferId`/`choferExternoId` de Viajes).
        return (
          (hasViajes || hasStock || hasCombustible) &&
          (superadmin || hasAlgunaPertenenciaChofer) &&
          (superadmin ||
            hasCombustible ||
            hasStock ||
            isViajesFieldVisible("alta_viaje", "choferId") ||
            isViajesFieldVisible("alta_viaje", "choferExternoId"))
        );
      case "productos":
        // Stock siempre necesita productos. Sin Stock, depende del switch
        // "Productos" (Configuración por empresa → General, campo
        // `productoItems` de Viajes).
        return (
          hasStock ||
          (hasViajes &&
            (superadmin || isViajesFieldVisible("alta_viaje", "productoItems")))
        );
      case "presentaciones":
        return hasStock;
      case "depositos":
        return hasStock;
      case "direcciones-entrega":
        return hasStock;
      case "paises":
        // Si el superadmin fijó el país (ver CamposEmpresaPage → "Ocultar país"),
        // el tenant no elige país en ningún lado — no tiene sentido dejarle
        // administrar su propio catálogo de países.
        return hasViajes && !tenant?.paisOrigenDestinoOculto;
      case "usuarios":
        return isOrgAdmin;
      // Solo admin de tenant, no superadmin: éste ya tiene su propia entrada
      // de import (con selector de tenant) desde el panel superadmin.
      case "importar":
        return (
          !superadmin &&
          isOrgAdmin &&
          hasViajes &&
          !tenant?.importacionesOcultas
        );
    }
  });

  const [sectionSheetOpen, setSectionSheetOpen] = useState(false);

  const rawTab = searchParams.get("tab") as Tab | null;
  const activeTab: Tab =
    rawTab && visibleTabs.some((t) => t.id === rawTab)
      ? rawTab
      : (visibleTabs[0]?.id ?? "clientes");

  const activeTabDef = visibleTabs.find((t) => t.id === activeTab);
  const ActiveIcon = activeTabDef?.icon;

  // "Importar datos" ya no se renderiza como contenido de esta pestaña —
  // es una página propia. Si alguien llega con ?tab=importar en la URL
  // (link viejo, back del navegador), lo mandamos a la página real.
  if (activeTab === "importar") {
    return <Navigate to="/importar" replace />;
  }

  // Mobile: mismo orden que el menú (por módulo) y el módulo a la derecha de cada opción.
  const sectionOptions: SelectorOpcion[] = GRUPOS.flatMap((grupo) =>
    visibleTabs
      .filter((tab) => grupoDeTab(tab.id, hasStock) === grupo.id)
      .map((tab) => ({
        id: tab.id,
        label: tab.label,
        trailing: (
          <span className="text-[10px] uppercase tracking-[0.15em] text-vialto-steel/70">
            {grupo.label}
          </span>
        ),
      })),
  );

  function setTab(tab: Tab) {
    if (tab === "importar") {
      navigate("/importar");
      setSectionSheetOpen(false);
      return;
    }
    setSearchParams({ tab }, { replace: true });
    setSectionSheetOpen(false);
  }

  return (
    // Secciones en un menú vertical a la izquierda (desktop); en mobile, el selector.
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        {tabsLoading ? (
          <>
            <div className="lg:hidden" aria-hidden>
              <div className="h-11 w-full animate-pulse rounded-lg bg-black/[0.06]" />
            </div>
            <div className="hidden w-60 shrink-0 flex-col gap-1 lg:flex" aria-hidden>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-sm bg-black/[0.06]" />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="lg:hidden">
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
                    {activeTabDef?.label ?? "Clientes"}
                  </span>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-vialto-steel"
                    strokeWidth={2}
                    aria-hidden
                  />
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
              className="hidden w-60 shrink-0 flex-col gap-0.5 border-r border-black/10 pr-3 lg:sticky lg:top-4 lg:flex"
              aria-label="Secciones de base de datos"
            >
              {GRUPOS.map((grupo) => {
                const tabsGrupo = visibleTabs.filter(
                  (t) => grupoDeTab(t.id, hasStock) === grupo.id,
                );
                if (tabsGrupo.length === 0) return null;
                return (
                  <div key={grupo.id} className="mb-3 flex flex-col gap-0.5 last:mb-0">
                    <p className="px-3 pb-1 pt-1 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel/70">
                      {grupo.label}
                    </p>
              {tabsGrupo.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  className={[
                    "flex w-full items-center gap-2.5 rounded-sm border-l-2 px-3 py-2.5 text-left font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                    activeTab === tab.id
                      ? "border-l-vialto-fire bg-vialto-mist text-vialto-charcoal"
                      : "border-l-transparent text-vialto-steel hover:bg-black/[0.04] hover:text-vialto-charcoal",
                  ].join(" ")}
                >
                  <tab.icon
                    className="h-4 w-4 shrink-0"
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 leading-snug">{tab.label}</span>
                </button>
              ))}
                  </div>
                );
              })}
            </nav>
          </>
        )}

      <div className="min-w-0 flex-1">
        {activeTab === "clientes" && <ClientesPage />}
        {activeTab === "transportistas" && <TransportistasPage />}
        {activeTab === "choferes" && <ChoferesPage />}
        {activeTab === "destinatarios" && <DestinatariosPage />}
        {activeTab === "vehiculos" && <VehiculosPage />}
        {activeTab === "productos" && <ProductosPage />}
        {activeTab === "presentaciones" && <PresentacionesPage />}
        {activeTab === "depositos" && (
          <DepositosPage isPlatform={superadmin} />
        )}
        {activeTab === "direcciones-entrega" && <DireccionesEntregaPage />}
        {activeTab === "paises" && <PaisesPage />}
        {activeTab === "usuarios" &&
          (superadmin ? <SuperadminUsersPage /> : <UsuariosTenantPage />)}
      </div>
    </div>
  );
}
