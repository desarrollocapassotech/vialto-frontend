import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { EgresosStockTenantPage } from './EgresosStockTenantPage';
import { EgresosStockSuperadminPage } from './EgresosStockSuperadminPage';

export function EgresosStockPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <CargandoVialto mensaje="Preparando el egreso de stock…" />;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <EgresosStockSuperadminPage />;
  }

  return <EgresosStockTenantPage />;
}
