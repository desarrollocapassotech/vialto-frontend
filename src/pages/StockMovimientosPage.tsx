import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { StockMovimientosSuperadminPage } from './StockMovimientosSuperadminPage';
import { StockMovimientosTenantPage } from './StockMovimientosTenantPage';

export function StockMovimientosPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="text-vialto-steel py-12 text-center">Un momento…</div>;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <StockMovimientosSuperadminPage />;
  }

  return <StockMovimientosTenantPage />;
}
