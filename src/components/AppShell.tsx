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
import { canAccessFacturacion, canAccessViajes } from '@/lib/tenantModules';
import { isPlatformSuperadmin, userRoleDisplay } from '@/lib/roleLabels';
import {
  orgSwitcherSidebarAppearance,
  userButtonSidebarAppearance,
} from './clerkSidebarAppearance';

export function AppShell() {
  const { organization } = useOrganization();
  const { orgRole } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const { tenant } = useCurrentTenant();

  const superadmin =
    userLoaded && isPlatformSuperadmin(user?.publicMetadata);

  const nav = useMemo(() => {
    const homeLabel = superadmin ? 'Panorama' : 'Inicio';
    const items: { to: string; label: string; end?: boolean }[] = [{ to: '/', label: homeLabel, end: true }];

    if (superadmin) {
      items.push({ to: '/superadmin/empresas', label: 'Empresas' });
      items.push({ to: '/superadmin/usuarios', label: 'Usuarios' });
    }

    if (superadmin || canAccessViajes(tenant?.modules ?? [])) {
      items.push({ to: '/viajes', label: 'Viajes' });
    }

    if (superadmin || canAccessFacturacion(tenant?.modules ?? [])) {
      items.push({ to: '/facturacion', label: 'Facturación' });
    }

    // Entidades core: disponibles para toda empresa.
    items.push(
      { to: '/clientes', label: 'Clientes' },
      { to: '/transportistas', label: 'Transportistas' },
      { to: '/choferes', label: 'Choferes' },
      { to: '/vehiculos', label: 'Vehículos' },
    );

    return items;
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

  return (
    <div className="min-h-screen flex bg-vialto-mist">
      <aside className="w-64 shrink-0 bg-vialto-charcoal text-vialto-mist flex flex-col py-6 px-4 gap-6">
        <div className="px-1">
          <Logo heightClass="h-14 max-w-[11rem]" />
          <p className="mt-2 font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.25em] text-white/40">
            TRANSPORTE Y LOGISTICA
          </p>
        </div>

        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end === true}
              className={({ isActive }) =>
                [
                  'rounded px-3 py-2 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider transition-colors',
                  isActive
                    ? 'bg-vialto-fire text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
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
                  afterSignOutUrl="/sign-in"
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
