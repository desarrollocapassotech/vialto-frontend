import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  OrganizationSwitcher,
  UserButton,
  useAuth,
  useClerk,
  useOrganization,
  useUser,
} from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Building2,
  Split,
  Calculator,
  Database,
  House,
  Landmark,
  Menu,
  PackageMinus,
  PackagePlus,
  Receipt,
  Truck,
  Warehouse,
  Users,
  LogOut,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from './Logo';
import { useMaestroData } from '@/hooks/useMaestroData';
import { canAccessFacturacion, canAccessLiquidacionesArca, canAccessStock, canAccessViajes } from '@/lib/tenantModules';
import { isPlatformSuperadmin, userRoleDisplay } from '@/lib/roleLabels';
import {
  orgSwitcherSidebarAppearance,
  userButtonSidebarAppearance,
} from './clerkSidebarAppearance';

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; extraActivePaths?: string[] };

type NavGroup = {
  /** `null` = sin rótulo (p. ej. solo inicio). */
  title: string | null;
  items: NavItem[];
};

const sidebarAsideClass =
  'w-64 shrink-0 bg-vialto-charcoal text-vialto-mist flex flex-col py-6 px-4 gap-6 h-[100dvh] overflow-y-auto';

export function AppShell() {
  const { organization } = useOrganization();
  const { orgRole } = useAuth();
  const { signOut } = useClerk();
  const { user, isLoaded: userLoaded } = useUser();
  const { tenant, tenantLoading } = useMaestroData();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const superadmin =
    userLoaded && isPlatformSuperadmin(user?.publicMetadata);

  async function handleSignOut() {
    await signOut();
  }

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  const navLoading = !userLoaded || tenantLoading;

  const navGroups = useMemo((): NavGroup[] => {
    const isMember = orgRole === 'org:member';

    // org:member: solo ve Ingresos y Egresos del módulo de stock
    if (isMember) {
      if (canAccessStock(tenant?.modules ?? [])) {
        return [{
          title: 'Stock',
          items: [
            { to: '/stock/ingresos', label: 'Ingresos', icon: PackagePlus },
            { to: '/stock/egresos', label: 'Egresos', icon: PackageMinus },
          ],
        }];
      }
      return [];
    }

    const homeLabel = superadmin ? 'Panorama' : 'Inicio';
    const groups: NavGroup[] = [
      { title: null, items: [{ to: '/', label: homeLabel, icon: House, end: true }] },
    ];

    if (superadmin) {
      groups.push({
        title: 'Plataforma',
        items: [
          { to: '/superadmin/empresas', label: 'Empresas', icon: Building2 },
          { to: '/superadmin/usuarios', label: 'Usuarios', icon: Users },
          { to: '/superadmin/arca', label: 'ARCA / AFIP', icon: Landmark },
        ],
      });
    }

    if (superadmin || canAccessViajes(tenant?.modules ?? [])) {
      groups.push({
        title: 'Viajes y flota',
        items: [{ to: '/viajes', label: 'Viajes', icon: Truck }],
      });
    }

    if (superadmin || canAccessFacturacion(tenant?.modules ?? [])) {
      groups.push({
        title: 'Facturación',
        items: [{ to: '/facturacion', label: 'Facturación', icon: Receipt }],
      });
    }

    if (canAccessLiquidacionesArca(tenant?.modules ?? [])) {
      groups.push({
        title: 'Liquidaciones',
        items: [{ to: '/liquidaciones', label: 'Liquidaciones CVLP', icon: Calculator }],
      });
    }

    if (superadmin || canAccessStock(tenant?.modules ?? [])) {
      groups.push({
        title: 'Stock',
        items: [
          { to: '/stock/inventario', label: 'Inventario', icon: Warehouse },
          { to: '/stock/ingresos', label: 'Ingresos', icon: PackagePlus },
          { to: '/stock/egresos', label: 'Egresos', icon: PackageMinus },
          { to: '/stock/divisiones', label: 'Divisiones', icon: Split },
          { to: '/stock/movimientos', label: 'Movimientos', icon: ArrowLeftRight, end: true },
        ],
      });
    }

    groups.push({
      title: 'Base de datos',
      items: [
        {
          to: '/base-de-datos',
          label: 'Base de datos',
          icon: Database,
          extraActivePaths: [
            '/clientes',
            '/transportistas',
            '/choferes',
            '/vehiculos',
            '/stock/productos',
          ],
        },
      ],
    });

    return groups;
  }, [superadmin, tenant?.modules, orgRole]);

  const platformRole =
    typeof user?.publicMetadata?.vialtoRole === 'string'
      ? user.publicMetadata.vialtoRole
      : null;

  const roleText = userLoaded
    ? userRoleDisplay({
        orgRole,
        platformRole,
        hasOrganization: Boolean(organization),
      })
    : '…';

  const accountAvatarUrl = useMemo(() => {
    const googleAccount = user?.externalAccounts?.find(
      (account) => account.provider === 'google',
    );
    const hasClerkImage = Boolean(user?.hasImage && user?.imageUrl);
    if (hasClerkImage) return user?.imageUrl ?? null;
    return googleAccount?.imageUrl ?? user?.imageUrl ?? null;
  }, [user]);

  const accountName =
    user?.fullName?.trim() ||
    user?.primaryEmailAddress?.emailAddress ||
    'Cuenta';

  const accountInitial =
    accountName.trim().charAt(0).toUpperCase() || 'U';

  const clickableAvatarUserButtonAppearance = {
    ...userButtonSidebarAppearance,
    elements: {
      ...userButtonSidebarAppearance.elements,
      rootBox: 'h-8 w-8 shrink-0',
      userButtonTrigger:
        'h-8 w-8 rounded-full border border-white/15 bg-transparent hover:bg-white/10 transition-colors',
      userButtonAvatarBox: 'opacity-0',
    },
  } as const;

  const isTestKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_');
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  const isLocal = !apiUrl || apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1');
  const neonBranch = import.meta.env.VITE_NEON_BRANCH as string | undefined;
  const clerkEnv = isTestKey ? 'Clerk Dev' : 'Clerk Prod';

  const envBadge = isTestKey
    ? isLocal
      ? { label: 'Backend: LOCAL', cls: 'text-sky-900 bg-sky-400 border-sky-500' }
      : { label: 'Backend: QA', cls: 'text-amber-900 bg-amber-400 border-amber-500' }
    : null;

  function renderSidebar(showCloseButton: boolean) {
    return (
      <>
        <div className={`px-1 ${showCloseButton ? 'flex items-start justify-between gap-2' : ''}`}>
          <div className="min-w-0">
            <Logo heightClass="h-14 max-w-[11rem]" />
            <p className="mt-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.25em] text-white/40">
              TRANSPORTE Y LOGISTICA
            </p>
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Cerrar menú"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 text-white/80 hover:bg-white/10"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          )}
        </div>

        <nav className="flex flex-col gap-3">
          {navLoading ? (
            <div className="flex flex-col gap-2" aria-hidden>
              {[80, 65, 75, 55, 70].map((w, i) => (
                <div
                  key={i}
                  className="h-10 rounded-md bg-white/10 animate-pulse"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          ) : navGroups.map((group, gi) => (
            <div key={group.title ?? `g-${gi}`} className="flex flex-col gap-0.5">
              {gi > 0 && (
                <div className="mb-2 border-t border-white/[0.12]" />
              )}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end === true}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => {
                    const active =
                      isActive ||
                      (item.extraActivePaths?.some((p) =>
                        location.pathname.startsWith(p),
                      ) ?? false);
                    return [
                      'flex min-h-11 items-center gap-2.5 rounded-md px-3 py-2.5 font-[family-name:var(--font-ui)] text-sm font-medium uppercase tracking-wider transition-colors border',
                      active
                        ? 'border-vialto-fire bg-vialto-fire text-white shadow-sm'
                        : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
                    ].join(' ');
                  }}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-5 pt-4 border-t border-white/10">
          <div className="space-y-2">
            <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-white/45 pl-0.5">
              Empresa
            </p>
            <div className="w-full min-w-0">
              {superadmin ? (
                <OrganizationSwitcher
                  hidePersonal
                  afterCreateOrganizationUrl="/"
                  afterSelectOrganizationUrl="/"
                  appearance={orgSwitcherSidebarAppearance}
                />
              ) : (
                <div className="rounded-md border border-white/15 bg-white/5 px-2.5 py-2 text-white/80">
                  {organization?.name ?? 'Empresa no disponible'}
                </div>
              )}
            </div>
            {!organization && (
              <p className="text-xs leading-snug text-amber-300/95 pl-0.5 pr-1">
                {superadmin
                  ? 'Elegí o creá una empresa para ver los datos de tu equipo.'
                  : 'No podés cambiar la empresa con este rol.'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-white/45 pl-0.5">
              Tu cuenta
            </p>
            <div className="pl-0.5 pr-1 flex items-center gap-2 min-w-0">
              <div className="relative h-8 w-8 shrink-0">
                <div className="absolute inset-0 pointer-events-none">
                  {accountAvatarUrl ? (
                    <img
                      src={accountAvatarUrl}
                      alt="Foto de perfil"
                      className="h-8 w-8 rounded-full object-cover ring-2 ring-white/20"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-white/10 text-white/80 text-xs font-semibold flex items-center justify-center ring-2 ring-white/20">
                      {accountInitial}
                    </div>
                  )}
                </div>
                {superadmin && (
                  <UserButton
                    afterSignOutUrl="/sign-in"
                    appearance={clickableAvatarUserButtonAppearance}
                  />
                )}
              </div>
              <p className="text-sm text-white/90 truncate flex-1">{accountName}</p>
            </div>
            {!superadmin && (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-left text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar sesión</span>
              </button>
            )}
            <div className="pl-0.5 pt-1 space-y-0.5">
              <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-white/45">
                Rol
              </p>
              <p className="text-sm text-white/90 leading-snug pr-1">{roleText}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-vialto-mist overflow-x-clip">
      {envBadge && (
        <div className="fixed top-2 right-3 z-[60] pointer-events-none hidden sm:flex items-center gap-1.5 max-w-[calc(100vw-1rem)]">
          {neonBranch && (
            <span className="font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.15em] border px-2 py-0.5 rounded-sm text-emerald-900 bg-emerald-400 border-emerald-500">
              Neon: {neonBranch}
            </span>
          )}
          <span className="font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.15em] border px-2 py-0.5 rounded-sm text-violet-900 bg-violet-400 border-violet-500">
            {clerkEnv}
          </span>
          <span className={`font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.15em] border px-2 py-0.5 rounded-sm ${envBadge.cls}`}>
            {envBadge.label}
          </span>
        </div>
      )}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`hidden lg:flex sticky top-0 ${sidebarAsideClass}`}>
        {renderSidebar(false)}
      </aside>

      <aside
        aria-hidden={!sidebarOpen}
        className={[
          sidebarAsideClass,
          'lg:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none',
        ].join(' ')}
      >
        {renderSidebar(true)}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-vialto-charcoal px-4 py-3 lg:hidden">
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white hover:bg-white/10"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <Logo heightClass="h-8 max-w-[8rem]" />
        </header>

        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
