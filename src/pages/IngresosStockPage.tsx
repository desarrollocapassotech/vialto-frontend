import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { IngresosStockTenantPage } from './IngresosStockTenantPage';
import { IngresosStockSuperadminPage } from './IngresosStockSuperadminPage';

export function IngresosStockPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <CargandoVialto mensaje="Preparando el ingreso de stock…" />;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <IngresosStockSuperadminPage />;
  }

  return <IngresosStockTenantPage />;
}
