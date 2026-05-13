import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { IngresosStockHistorialSuperadminPage } from './IngresosStockHistorialSuperadminPage';
import { IngresosStockHistorialTenantPage } from './IngresosStockHistorialTenantPage';

export function IngresosStockHistorialPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="text-vialto-steel py-12 text-center">Un momento…</div>;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <IngresosStockHistorialSuperadminPage />;
  }

  return <IngresosStockHistorialTenantPage />;
}
