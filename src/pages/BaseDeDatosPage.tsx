import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import {
  Car,
  ChevronDown,
  Layers,
  Package,
  ShieldCheck,
  Truck,
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
import { VehiculosPage } from "./VehiculosPage";
import { ProductosPage } from "./ProductosPage";
import { DepositosPage } from "./DepositosPage";
import { PresentacionesPage } from "./PresentacionesPage";
import { SuperadminUsersPage } from "./SuperadminUsersPage";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { canAccessViajes, canAccessStock } from "@/lib/tenantModules";
import { isPlatformSuperadmin } from "@/lib/roleLabels";
import { useAuth } from "@clerk/clerk-react";

type Tab =
  | "clientes"
  | "transportistas"
  | "choferes"
  | "vehiculos"
  | "productos"
  | "presentaciones"
  | "depositos"
  | "usuarios";

const ALL_TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "transportistas", label: "Transportistas", icon: Truck },
  { id: "choferes", label: "Choferes", icon: UserCheck },
  { id: "vehiculos", label: "Vehículos", icon: Car },
  { id: "productos", label: "Productos", icon: Package },
  { id: "presentaciones", label: "Presentaciones", icon: Layers },
  { id: "depositos", label: "Depósitos", icon: Warehouse },
  { id: "usuarios", label: "Usuarios", icon: ShieldCheck },
];

export function BaseDeDatosPage() {
  const { user, isLoaded } = useUser();
  const { orgRole } = useAuth();
  const { tenant, loading: tenantLoading } = useCurrentTenant();
  const [searchParams, setSearchParams] = useSearchParams();

  const superadmin = isLoaded && isPlatformSuperadmin(user?.publicMetadata);
  const tabsLoading = !isLoaded || tenantLoading;
  const modules = tenant?.modules ?? [];
  const hasViajes = superadmin || canAccessViajes(modules);
  const hasStock = superadmin || canAccessStock(modules);
  const isOrgAdmin = superadmin || orgRole === "org:admin";

  const visibleTabs = ALL_TABS.filter((tab) => {
    switch (tab.id) {
      case "clientes":
        return true;
      case "transportistas":
      case "choferes":
      case "vehiculos":
        return hasViajes;
      case "productos":
        return hasViajes || hasStock;
      case "presentaciones":
        return hasStock;
      case "depositos":
        return hasStock;
      case "usuarios":
        return isOrgAdmin;
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

  const sectionOptions: SelectorOpcion[] = visibleTabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
  }));

  function setTab(tab: Tab) {
    setSearchParams({ tab }, { replace: true });
    setSectionSheetOpen(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-black/15">
        {tabsLoading ? (
          <>
            <div className="pb-3 lg:hidden" aria-hidden>
              <div className="h-11 w-full animate-pulse rounded-lg bg-black/[0.06]" />
            </div>
            <div className="-mb-px hidden gap-1 pb-px lg:flex" aria-hidden>
              {[100, 130, 90, 100, 95].map((w, i) => (
                <div
                  key={i}
                  className="h-10 rounded-t-sm bg-black/[0.06] animate-pulse"
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
          </>
        ) : (
          <>
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
              className="-mb-px hidden gap-1 lg:flex"
              aria-label="Secciones de base de datos"
            >
              {visibleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={[
                    "flex items-center gap-2 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] rounded-t-sm transition-colors border",
                    activeTab === tab.id
                      ? "border-black/15 border-t-2 border-t-vialto-fire border-b-vialto-mist bg-vialto-mist text-vialto-charcoal"
                      : "border-transparent text-vialto-steel hover:text-vialto-charcoal hover:bg-black/[0.04]",
                  ].join(" ")}
                >
                  <tab.icon
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={1.75}
                  />
                  {tab.label}
                </button>
              ))}
            </nav>
          </>
        )}
      </div>

      <div>
        {activeTab === "clientes" && <ClientesPage />}
        {activeTab === "transportistas" && <TransportistasPage />}
        {activeTab === "choferes" && <ChoferesPage />}
        {activeTab === "vehiculos" && <VehiculosPage />}
        {activeTab === "productos" && <ProductosPage />}
        {activeTab === "presentaciones" && <PresentacionesPage />}
        {activeTab === "depositos" && <DepositosPage />}
        {activeTab === "usuarios" && <SuperadminUsersPage />}
      </div>
    </div>
  );
}
