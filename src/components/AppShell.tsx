import { NavLink, Outlet } from 'react-router-dom';
import {
  OrganizationSwitcher,
  UserButton,
  useAuth,
  useOrganization,
  useUser,
} from '@clerk/clerk-react';
import { useMemo } from 'react';
import { Logo } from './Logo';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import { MaestroDataProvider } from '@/hooks/useMaestroData';
import { canAccessFacturacion, canAccessLiquidacionesArca, canAccessStock, canAccessViajes } from '@/lib/tenantModules';
import { isPlatformSuperadmin, userRoleDisplay } from '@/lib/roleLabels';
import {
  orgSwitcherSidebarAppearance,
  userButtonSidebarAppearance,
} from './clerkSidebarAppearance';

type NavItem = { to: string; label: string; end?: boolean };

type NavGroup = {
  /** `null` = sin rótulo (p. ej. solo inicio). */
  title: string | null;
  items: NavItem[];
};

export function AppShell() {
  const { organization } = useOrganization();
  const { orgRole } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const { tenant } = useCurrentTenant();

  const superadmin =
    userLoaded && isPlatformSuperadmin(user?.publicMetadata);

  const navGroups = useMemo((): NavGroup[] => {
    const homeLabel = superadmin ? 'Panorama' : 'Inicio';
    const groups: NavGroup[] = [
      { title: null, items: [{ to: '/', label: homeLabel, end: true }] },
    ];

    if (superadmin) {
      groups.push({
        title: 'Plataforma',
        items: [
          { to: '/superadmin/empresas', label: 'Empresas' },
          { to: '/superadmin/usuarios', label: 'Usuarios' },
          { to: '/superadmin/arca', label: 'ARCA / AFIP' },
        ],
      });
    }

    const viajesModule = superadmin || canAccessViajes(tenant?.modules ?? []);
    if (viajesModule) {
      const items: NavItem[] = [{ to: '/viajes', label: 'Viajes' }];
      items.push(
        { to: '/transportistas', label: 'Transportistas' },
        { to: '/choferes', label: 'Choferes' },
        { to: '/vehiculos', label: 'Vehículos' },
      );
      groups.push({ title: 'Viajes y flota', items });
    }

    if (superadmin || canAccessFacturacion(tenant?.modules ?? [])) {
      groups.push({
        title: 'Facturación',
        items: [{ to: '/facturacion', label: 'Facturación' }],
      });
    }

    if (canAccessLiquidacionesArca(tenant?.modules ?? [])) {
      groups.push({
        title: 'Liquidaciones',
        items: [{ to: '/liquidaciones', label: 'Liquidaciones CVLP' }],
      });
    }

    if (superadmin || canAccessStock(tenant?.modules ?? [])) {
      groups.push({
        title: 'Stock',
        items: [
          { to: '/stock/productos', label: 'Productos' },
          { to: '/stock/ingresos', label: 'Ingresos' },
          { to: '/stock/egresos', label: 'Egresos' },
          { to: '/stock/movimientos', label: 'Movimientos', end: true },
        ],
      });
    }

    groups.push({
      title: 'Comercial',
      items: [{ to: '/clientes', label: 'Clientes' }],
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

  const isNonProd = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_');

  return (
    <div className="min-h-screen flex bg-vialto-mist">
      {isNonProd && (
        <div className="fixed top-2 right-3 z-50 pointer-events-none">
          <span className="font-[family-name:var(--font-ui)] text-[9px] uppercase tracking-[0.2em] text-amber-400/60 bg-amber-950/30 border border-amber-400/20 px-2 py-0.5 rounded-sm">
            QA
          </span>
        </div>
      )}
      <aside className="w-64 shrink-0 bg-vialto-charcoal text-vialto-mist flex flex-col py-6 px-4 gap-6">
        <div className="px-1">
          <Logo heightClass="h-14 max-w-[11rem]" />
          <p className="mt-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.25em] text-white/40">
            TRANSPORTE Y LOGISTICA
          </p>
        </div>

        <nav className="flex flex-col gap-5">
          {navGroups.map((group, gi) => (
            <div key={group.title ?? `g-${gi}`} className="flex flex-col gap-0.5">
              {group.title &&
              (group.items.length > 1 ||
                group.items[0].label.toLowerCase() !== group.title.toLowerCase()) ? (
                <div className="mb-1.5 px-2">
                  <div className="flex items-center gap-2 border-b border-white/20 pb-2">
                    <span
                      className="h-4 w-1 shrink-0 rounded-sm bg-vialto-fire/90"
                      aria-hidden
                    />
                    <p className="font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.2em] text-white/95">
                      {group.title}
                    </p>
                  </div>
                </div>
              ) : null}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end === true}
                  className={({ isActive }) =>
                    [
                      'rounded-md px-3 py-2.5 font-[family-name:var(--font-ui)] text-sm font-medium uppercase tracking-wider transition-colors border',
                      isActive
                        ? 'border-vialto-fire bg-vialto-fire text-white shadow-sm'
                        : 'border-white/10 bg-white/[0.03] text-white/65 hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
                    ].join(' ')
                  }
                >
                  {item.label}
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
              <OrganizationSwitcher
                hidePersonal
                afterCreateOrganizationUrl="/"
                afterSelectOrganizationUrl="/"
                appearance={orgSwitcherSidebarAppearance}
              />
            </div>
            {!organization && (
              <p className="text-xs leading-snug text-amber-300/95 pl-0.5 pr-1">
                Elegí o creá una empresa para ver los datos de tu equipo.
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
                <UserButton
                  afterSignOutUrl="/#/sign-in"
                  appearance={clickableAvatarUserButtonAppearance}
                />
              </div>
              <p className="text-sm text-white/90 truncate flex-1">{accountName}</p>
            </div>
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
