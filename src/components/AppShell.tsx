import { NavLink, Outlet } from 'react-router-dom';
import {
  OrganizationSwitcher,
  UserButton,
  useOrganization,
} from '@clerk/clerk-react';
import { Logo } from './Logo';
import {
  orgSwitcherSidebarAppearance,
  userButtonSidebarAppearance,
} from './clerkSidebarAppearance';

const nav: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/viajes', label: 'Viajes' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/choferes', label: 'Choferes' },
  { to: '/vehiculos', label: 'Vehículos' },
];

export function AppShell() {
  const { organization } = useOrganization();

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
            <div className="w-full min-w-0 flex justify-start">
              <UserButton
                afterSignOutUrl="/sign-in"
                appearance={userButtonSidebarAppearance}
              />
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-8">
        <Outlet />
      </main>
    </div>
  );
}
