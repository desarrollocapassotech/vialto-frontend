import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { IngresosStockTenantPage } from './IngresosStockTenantPage';
import { IngresosStockSuperadminPage } from './IngresosStockSuperadminPage';

export function IngresosStockPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="text-vialto-steel py-12 text-center">Un momento…</div>;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <IngresosStockSuperadminPage />;
  }

  return <IngresosStockTenantPage />;
}
