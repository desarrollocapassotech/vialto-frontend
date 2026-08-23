import { NavLink, Outlet, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  useAuth,
  useClerk,
  useOrganization,
  useUser,
} from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Building2,
  Split,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Database,
  Fuel,
  House,
  Landmark,
  Menu,
  PackageMinus,
  PackagePlus,
  Receipt,
  SlidersHorizontal,
  Truck,
  Warehouse,
  LogOut,
  X,
  type LucideIcon,
} from "lucide-react";
import { Breadcrumbs } from "./shared/Breadcrumbs";
import { NotificationBell } from "./NotificationBell";
import { useEnsureTenantOrganization } from "@/hooks/useEnsureTenantOrganization";
import { BreadcrumbOverrideProvider } from "@/hooks/useBreadcrumbOverride";
import { useMaestroData } from "@/hooks/useMaestroData";
import {
  canAccessCombustible,
  canAccessFacturacion,
  canAccessIntegracionArca,
  canAccessStock,
  canAccessViajes,
} from "@/lib/tenantModules";
import {
  isPlatformSuperadmin,
  isOrgMember,
  isStockViewer,
  isStockOperator,
  puedeGestionarComoAdminEmpresa,
  userRoleDisplay,
} from "@/lib/roleLabels";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  extraActivePaths?: string[];
};

type NavGroup = {
  /** `null` = sin rótulo (p. ej. solo inicio). */
  title: string | null;
  items: NavItem[];
};

const HEADER_HEIGHT_CLASS = "h-16";

const sidebarBaseClass =
  "sidebar-scrollbar shrink-0 bg-vialto-charcoal text-vialto-mist flex flex-col py-6 gap-6 overflow-y-auto transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";
const sidebarExpandedWidthClass = "w-[16rem] max-w-[92vw] px-4";
const sidebarCollapsedWidthClass = "w-[4.5rem] px-2";

export function AppShell() {
  const { organization } = useOrganization();
  const { orgRole } = useAuth();
  const { signOut } = useClerk();
  const { user, isLoaded: userLoaded } = useUser();
  const { tenant, tenantLoading } = useMaestroData();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [navTooltip, setNavTooltip] = useState<{
    label: string;
    top: number;
    left: number;
  } | null>(null);
  useEnsureTenantOrganization();

  const superadmin = userLoaded && isPlatformSuperadmin(user?.publicMetadata);

  async function handleSignOut() {
    await signOut();
  }

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  const navLoading = !userLoaded || tenantLoading;
  const roleCtx = useMemo(
    () => ({ orgRole, publicMetadata: user?.publicMetadata }),
    [orgRole, user?.publicMetadata],
  );
  const stockViewer = isStockViewer(roleCtx);
  const stockOperator = isStockOperator(roleCtx);
  const canSeeNotificaciones =
    Boolean(organization) && puedeGestionarComoAdminEmpresa(orgRole, user?.publicMetadata);

  const navGroups = useMemo((): NavGroup[] => {
    if (isOrgMember(roleCtx)) {
      // 1. Inicializamos el grupo de navegación del Miembro incluyendo "Inicio"
      const memberGroups: NavGroup[] = [
        {
          title: null,
          items: [{ to: "/", label: "Inicio", icon: House, end: true }],
        },
      ];

      if (canAccessStock(tenant?.modules ?? [])) {
        memberGroups.push({
          title: "Stock",
          items: [
            { to: "/stock/ingresos", label: "Ingresos", icon: PackagePlus },
            { to: "/stock/egresos", label: "Egresos", icon: PackageMinus },
          ],
        });
      }

      if (canAccessCombustible(tenant?.modules ?? [])) {
        memberGroups.push({
          title: "Combustible",
          items: [{ to: "/combustible", label: "Cargas", icon: Fuel }],
        });
      }

      return memberGroups;
    }

    if (isStockViewer(roleCtx)) {
      if (canAccessStock(tenant?.modules ?? [])) {
        return [
          {
            title: "Stock",
            items: [
              {
                to: "/stock/inventario",
                label: "Inventario",
                icon: Warehouse,
              },
              {
                to: "/stock/movimientos",
                label: "Movimientos",
                icon: ArrowLeftRight,
                end: true,
              },
            ],
          },
        ];
      }
      return [];
    }

    if (isStockOperator(roleCtx)) {
      if (canAccessStock(tenant?.modules ?? [])) {
        return [
          {
            title: "Stock",
            items: [
              { to: "/stock/ingresos", label: "Ingresos", icon: PackagePlus },
              { to: "/stock/egresos", label: "Egresos", icon: PackageMinus },
            ],
          },
        ];
      }
      return [];
    }

    const homeLabel = superadmin ? "Panorama" : "Inicio";
    const groups: NavGroup[] = [
      {
        title: null,
        items: [{ to: "/", label: homeLabel, icon: House, end: true }],
      },
    ];

    if (superadmin) {
      groups.push({
        title: "Plataforma",
        items: [
          { to: "/superadmin/empresas", label: "Empresas", icon: Building2 },
          { to: "/superadmin/arca", label: "ARCA / AFIP", icon: Landmark },
          {
            to: "/superadmin/campos-empresa",
            label: "Configuración por empresa",
            icon: SlidersHorizontal,
          },
        ],
      });
    }

    if (superadmin || canAccessViajes(tenant?.modules ?? [])) {
      groups.push({
        title: "Viajes y flota",
        items: [{ to: "/viajes", label: "Viajes", icon: Truck }],
      });
    }

    const hasFacturacion =
      superadmin || canAccessFacturacion(tenant?.modules ?? []);
    const hasArca = canAccessIntegracionArca(tenant?.modules ?? []);
    const hasLiquidaciones = superadmin || hasFacturacion || hasArca;

    if (hasFacturacion || hasArca) {
      const facturacionItems: NavItem[] = [];

      if (hasFacturacion) {
        facturacionItems.push({
          to: "/facturacion",
          label: "Facturas",
          icon: Receipt,
          end: true,
        });
      }

      if (hasLiquidaciones) {
        facturacionItems.push({
          to: "/liquidaciones",
          label: "Liquidaciones",
          icon: Calculator,
          end: true,
        });

        // --- NUEVA LÓGICA DE CONFIGURACIÓN ---
        if (!superadmin) {
          if (hasArca) {
            facturacionItems.push({
              to: "/configuracion/arca",
              label: "Configuración ARCA",
              icon: Landmark,
            });
          } else if (hasFacturacion) {
            facturacionItems.push({
              to: "/configuracion/conceptos",
              label: "Configuración de conceptos",
              icon: SlidersHorizontal, // Podés usar SlidersHorizontal o importar Settings / FileText
            });
          }
        }
        // -------------------------------------
      }

      groups.push({ title: "Facturación", items: facturacionItems });
    }

    if (superadmin || canAccessStock(tenant?.modules ?? [])) {
      groups.push({
        title: "Stock",
        items: [
          { to: "/stock/inventario", label: "Inventario", icon: Warehouse },
          { to: "/stock/ingresos", label: "Ingresos", icon: PackagePlus },
          { to: "/stock/egresos", label: "Egresos", icon: PackageMinus },
          { to: "/stock/divisiones", label: "Divisiones", icon: Split },
          {
            to: "/stock/movimientos",
            label: "Movimientos",
            icon: ArrowLeftRight,
            end: true,
          },
        ],
      });
    }

    if (superadmin || canAccessCombustible(tenant?.modules ?? [])) {
      groups.push({
        title: "Combustible",
        items: [{ to: "/combustible", label: "Cargas", icon: Fuel }],
      });
    }

    groups.push({
      title: "Base de datos",
      items: [
        {
          to: "/base-de-datos",
          label: "Base de datos",
          icon: Database,
          extraActivePaths: [
            "/clientes",
            "/transportistas",
            "/choferes",
            "/vehiculos",
            "/stock/productos",
            "/usuarios",
          ],
        },
      ],
    });

    return groups;
  }, [superadmin, tenant?.modules, roleCtx]);

  const platformRole =
    typeof user?.publicMetadata?.vialtoRole === "string"
      ? user.publicMetadata.vialtoRole
      : null;

  const roleText = userLoaded
    ? userRoleDisplay({
        orgRole,
        platformRole,
        hasOrganization: Boolean(organization),
      })
    : "…";

  const accountAvatarUrl = useMemo(() => {
    const googleAccount = user?.externalAccounts?.find(
      (account) => account.provider === "google",
    );
    const hasClerkImage = Boolean(user?.hasImage && user?.imageUrl);
    if (hasClerkImage) return user?.imageUrl ?? null;
    return googleAccount?.imageUrl ?? user?.imageUrl ?? null;
  }, [user]);

  const accountName =
    user?.fullName?.trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    "Cuenta";

  const accountInitial = accountName.trim().charAt(0).toUpperCase() || "U";

  const isTestKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith(
    "pk_test_",
  );
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  const isLocal =
    !apiUrl || apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");
  const neonBranch = import.meta.env.VITE_NEON_BRANCH as string | undefined;
  const clerkEnv = isTestKey ? "Clerk Dev" : "Clerk Prod";

  const envBadge = isTestKey
    ? isLocal
      ? {
          label: "Backend: LOCAL",
          cls: "text-sky-900 bg-sky-400 border-sky-500",
        }
      : {
          label: "Backend: QA",
          cls: "text-amber-900 bg-amber-400 border-amber-500",
        }
    : null;

  function renderSidebar(showCloseButton: boolean, collapsed: boolean) {
    return (
      <>
        {showCloseButton && (
          <div className="px-1 flex justify-end">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Cerrar menú"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 text-white/80 hover:bg-white/10"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        )}

        <nav className={`flex flex-col gap-3 ${collapsed ? "items-center" : ""}`}>
          {navLoading ? (
            <div
              className={`flex flex-col gap-2 ${collapsed ? "items-center" : ""}`}
              aria-hidden
            >
              {[80, 65, 75, 55, 70].map((w, i) => (
                <div
                  key={i}
                  className="h-10 rounded-md bg-white/10 animate-pulse"
                  style={collapsed ? { width: "2.75rem" } : { width: `${w}%` }}
                />
              ))}
            </div>
          ) : (
            navGroups.map((group, gi) => (
              <div
                key={group.title ?? `g-${gi}`}
                className={`flex flex-col gap-0.5 ${collapsed ? "items-center" : ""}`}
              >
                {gi > 0 && (
                  <div
                    className={`mb-2 border-t border-white/[0.12] ${collapsed ? "w-8" : ""}`}
                  />
                )}
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end === true}
                    aria-label={collapsed ? item.label : undefined}
                    onMouseEnter={(e) => {
                      if (!collapsed) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      setNavTooltip({
                        label: item.label,
                        top: rect.top + rect.height / 2,
                        left: rect.right + 10,
                      });
                    }}
                    onMouseLeave={() => setNavTooltip(null)}
                    onClick={() => {
                      setSidebarOpen(false);
                      setNavTooltip(null);
                    }}
                    className={({ isActive }) => {
                      const active =
                        isActive ||
                        (item.extraActivePaths?.some((p) =>
                          location.pathname.startsWith(p),
                        ) ??
                          false);
                      return [
                        "flex min-h-11 items-center rounded-md font-[family-name:var(--font-ui)] text-sm font-medium uppercase tracking-wider transition-colors border",
                        collapsed ? "w-11 justify-center px-0" : "gap-2.5 px-3 py-2.5",
                        active
                          ? "border-vialto-fire bg-vialto-fire text-white shadow-sm"
                          : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
                      ].join(" ");
                    }}
                  >
                    <item.icon
                      className="h-4 w-4 shrink-0"
                      strokeWidth={1.75}
                    />
                    {!collapsed && (
                      <span className="whitespace-nowrap">{item.label}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            ))
          )}
        </nav>
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-vialto-mist overflow-x-clip">
      <header
        className={`sticky top-0 z-50 flex ${HEADER_HEIGHT_CLASS} shrink-0 items-center gap-3 bg-vialto-charcoal px-4`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10 lg:hidden"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <img
            src="/favicon.ico"
            alt="Vialto"
            className="h-9 w-9 shrink-0 rounded-md"
          />
          <div className="inline-flex flex-col justify-center leading-none">
            <span className="block [text-align-last:justify] [text-justify:inter-character] font-[family-name:var(--font-display)] text-lg text-vialto-fire">
              VIALTO
            </span>
            <span className="-mt-1 block [text-align-last:justify] [text-justify:inter-character] font-[family-name:var(--font-ui)] text-[10px] uppercase text-white">
              Software
            </span>
          </div>

          {organization && (
            <div className="hidden min-w-0 items-center gap-3 border-l border-white/10 pl-3 sm:flex">
              <span className="max-w-[9rem] truncate font-[family-name:var(--font-ui)] text-xs tracking-wide text-white/45 md:max-w-[14rem]">
                {organization.name}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex shrink-0 items-center gap-2">
          {envBadge && (
            <div className="hidden sm:flex items-center gap-1.5">
              {neonBranch && (
                <span className="font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.15em] border px-2 py-0.5 rounded-sm text-emerald-900 bg-emerald-400 border-emerald-500">
                  Neon: {neonBranch}
                </span>
              )}
              <span className="font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.15em] border px-2 py-0.5 rounded-sm text-violet-900 bg-violet-400 border-violet-500">
                {clerkEnv}
              </span>
              <span
                className={`font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.15em] border px-2 py-0.5 rounded-sm ${envBadge.cls}`}
              >
                {envBadge.label}
              </span>
            </div>
          )}

          {/* usuario */}
          <div className="hidden sm:flex min-w-0 items-center gap-2 pl-1">
            {accountAvatarUrl ? (
              <img
                src={accountAvatarUrl}
                alt="Foto de perfil"
                className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/20"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/80 ring-2 ring-white/20">
                {accountInitial}
              </div>
            )}
            <div className="flex min-w-0 flex-col justify-center leading-none">
              <span className="max-w-[9rem] truncate text-sm text-white/90">
                {accountName}
              </span>
              <span className="-mt-0.5 max-w-[9rem] truncate font-[family-name:var(--font-ui)] text-[10px] tracking-wide text-white/45">
                {roleText}
              </span>
            </div>
          </div>

          {/* notificaciones */}
          {canSeeNotificaciones && <NotificationBell />}

          {/* cerrar sesión */}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/85 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-x-0 top-16 bottom-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="sidebar-control-zone hidden lg:block fixed left-0 top-16 z-30 h-[calc(100dvh-4rem)]">
          <aside
            className={[
              "flex h-full",
              sidebarBaseClass,
              sidebarCollapsed ? sidebarCollapsedWidthClass : sidebarExpandedWidthClass,
            ].join(" ")}
          >
            {renderSidebar(false, sidebarCollapsed)}
          </aside>
          <button
            type="button"
            onClick={() => {
              setSidebarCollapsed((collapsed) => !collapsed);
              setNavTooltip(null);
            }}
            aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setNavTooltip({
                label: sidebarCollapsed ? "Expandir menú" : "Colapsar menú",
                top: rect.top + rect.height / 2,
                left: rect.right + 10,
              });
            }}
            onMouseLeave={() => setNavTooltip(null)}
            className="sidebar-expand-button group absolute top-1/2 -right-3 z-10 -mt-6 inline-flex h-12 w-7 cursor-pointer items-center justify-center rounded-r-lg border border-l-0 border-white/20 bg-vialto-fire text-white shadow-lg transition-[background-color,box-shadow,transform] duration-300 ease-out hover:bg-vialto-fire/90 hover:shadow-xl hover:brightness-110 active:scale-95"
          >
            {sidebarCollapsed ? (
              <ChevronRight
                className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5"
                strokeWidth={2.25}
              />
            ) : (
              <ChevronLeft
                className="h-4 w-4 transition-transform duration-300 ease-out group-hover:-translate-x-0.5"
                strokeWidth={2.25}
              />
            )}
          </button>
        </div>

        <aside
          aria-hidden={!sidebarOpen}
          className={[
            sidebarBaseClass,
            sidebarExpandedWidthClass,
            "lg:hidden fixed top-16 bottom-0 left-0 z-50 transition-transform duration-200 ease-in-out",
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full pointer-events-none",
          ].join(" ")}
        >
          {renderSidebar(true, false)}
        </aside>

        <div
          className={[
            "flex min-w-0 flex-1 flex-col transition-[margin-left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            sidebarCollapsed ? "lg:ml-[4.5rem]" : "lg:ml-[16rem]",
          ].join(" ")}
        >
          <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
            <BreadcrumbOverrideProvider>
              {(override) => (
                <>
                  <Breadcrumbs
                    override={override}
                    superadmin={superadmin}
                    stockViewer={stockViewer}
                    stockOperator={stockOperator}
                  />
                  <Outlet />
                </>
              )}
            </BreadcrumbOverrideProvider>
          </main>
        </div>
      </div>

      {navTooltip &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[200] -translate-y-1/2 whitespace-nowrap rounded-md bg-vialto-charcoal px-3.5 py-2 font-[family-name:var(--font-ui)] text-sm font-medium tracking-wide text-white shadow-lg"
            style={{ top: navTooltip.top, left: navTooltip.left }}
          >
            {navTooltip.label}
          </div>,
          document.body,
        )}
    </div>
  );
}
