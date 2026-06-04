import { useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { Car, Package, Truck, UserCheck, Users, Warehouse, type LucideIcon } from 'lucide-react';
import { ClientesPage } from './ClientesPage';
import { TransportistasPage } from './TransportistasPage';
import { ChoferesPage } from './ChoferesPage';
import { VehiculosPage } from './VehiculosPage';
import { ProductosPage } from './ProductosPage';
import { DepositosPage } from './DepositosPage';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import { canAccessViajes, canAccessStock } from '@/lib/tenantModules';
import { isPlatformSuperadmin } from '@/lib/roleLabels';

type Tab = 'clientes' | 'transportistas' | 'choferes' | 'vehiculos' | 'productos' | 'depositos';

const ALL_TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'clientes',       label: 'Clientes',       icon: Users      },
  { id: 'transportistas', label: 'Transportistas',  icon: Truck      },
  { id: 'choferes',       label: 'Choferes',        icon: UserCheck  },
  { id: 'vehiculos',      label: 'Vehículos',       icon: Car        },
  { id: 'productos',      label: 'Productos',       icon: Package    },
  { id: 'depositos',      label: 'Depósitos',       icon: Warehouse  },
];

export function BaseDeDatosPage() {
  const { user, isLoaded } = useUser();
  const { tenant, loading: tenantLoading } = useCurrentTenant();
  const [searchParams, setSearchParams] = useSearchParams();

  const superadmin = isLoaded && isPlatformSuperadmin(user?.publicMetadata);
  const tabsLoading = !isLoaded || tenantLoading;
  const modules = tenant?.modules ?? [];
  const hasViajes = superadmin || canAccessViajes(modules);
  const hasStock = superadmin || canAccessStock(modules);

  const visibleTabs = ALL_TABS.filter((tab) => {
    switch (tab.id) {
      case 'clientes': return true;
      case 'transportistas':
      case 'choferes':
      case 'vehiculos': return hasViajes;
      case 'productos': return hasViajes || hasStock;
      case 'depositos': return hasStock;
    }
  });

  const rawTab = searchParams.get('tab') as Tab | null;
  const activeTab: Tab =
    rawTab && visibleTabs.some((t) => t.id === rawTab)
      ? rawTab
      : (visibleTabs[0]?.id ?? 'clientes');

  function setTab(tab: Tab) {
    setSearchParams({ tab }, { replace: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-black/15">
        {tabsLoading ? (
          <div className="-mb-px flex gap-1 pb-px" aria-hidden>
            {[100, 130, 90, 100, 95].map((w, i) => (
              <div
                key={i}
                className="h-10 rounded-t-sm bg-black/[0.06] animate-pulse"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
        ) : (
          <nav className="-mb-px flex gap-1" aria-label="Secciones de base de datos">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={[
                  'flex items-center gap-2 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] rounded-t-sm transition-colors border',
                  activeTab === tab.id
                    ? 'border-black/15 border-t-2 border-t-vialto-fire border-b-vialto-mist bg-vialto-mist text-vialto-charcoal'
                    : 'border-transparent text-vialto-steel hover:text-vialto-charcoal hover:bg-black/[0.04]',
                ].join(' ')}
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div>
        {activeTab === 'clientes' && <ClientesPage />}
        {activeTab === 'transportistas' && <TransportistasPage />}
        {activeTab === 'choferes' && <ChoferesPage />}
        {activeTab === 'vehiculos' && <VehiculosPage />}
        {activeTab === 'productos' && <ProductosPage />}
        {activeTab === 'depositos' && <DepositosPage />}
      </div>
    </div>
  );
}
