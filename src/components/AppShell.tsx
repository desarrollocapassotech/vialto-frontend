import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  OrganizationSwitcher,
  UserButton,
  useAuth,
  useClerk,
  useOrganization,
  useUser,
} from '@clerk/clerk-react';
import { useMemo } from 'react';
import {
  ArrowLeftRight,
  Building2,
  Split,
  Calculator,
  Database,
  House,
  Landmark,
  PackageMinus,
  PackagePlus,
  Receipt,
  Truck,
  Users,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from './Logo';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import { MaestroDataProvider } from '@/hooks/useMaestroData';
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

export function AppShell() {
  const { organization } = useOrganization();
  const { orgRole } = useAuth();
  const { signOut } = useClerk();
  const { user, isLoaded: userLoaded } = useUser();
  const { tenant, loading: tenantLoading } = useCurrentTenant();
  const location = useLocation();

  const superadmin =
    userLoaded && isPlatformSuperadmin(user?.publicMetadata);

  async function handleSignOut() {
    await signOut();
  }

  const navLoading = !userLoaded || tenantLoading;

  const navGroups = useMemo((): NavGroup[] => {
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
  }, [superadmin, tenant?.modules]);

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

  return (
    <div className="min-h-screen flex bg-vialto-mist">
      {envBadge && (
        <div className="fixed top-2 right-3 z-50 pointer-events-none flex items-center gap-1.5">
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
      <aside className="w-64 shrink-0 bg-vialto-charcoal text-vialto-mist flex flex-col py-6 px-4 gap-6 sticky top-0 h-screen overflow-y-auto">
        <div className="px-1">
          <Logo heightClass="h-14 max-w-[11rem]" />
          <p className="mt-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.25em] text-white/40">
            TRANSPORTE Y LOGISTICA
          </p>
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
                  className={({ isActive }) => {
                    const active =
                      isActive ||
                      (item.extraActivePaths?.some((p) =>
                        location.pathname.startsWith(p),
                      ) ?? false);
                    return [
                      'flex items-center gap-2.5 rounded-md px-3 py-2.5 font-[family-name:var(--font-ui)] text-sm font-medium uppercase tracking-wider transition-colors border',
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
                className="mt-2 flex w-full items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-left text-sm font-medium text-white/80 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
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
      </aside>

      <main className="flex-1 min-w-0 p-8">
        <MaestroDataProvider>
          <Outlet />
        </MaestroDataProvider>
      </main>
    </div>
  );
}
