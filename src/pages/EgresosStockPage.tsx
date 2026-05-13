import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { EgresosStockTenantPage } from './EgresosStockTenantPage';
import { EgresosStockSuperadminPage } from './EgresosStockSuperadminPage';

export function EgresosStockPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="text-vialto-steel py-12 text-center">Un momento…</div>;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <EgresosStockSuperadminPage />;
  }

  return <EgresosStockTenantPage />;
}
