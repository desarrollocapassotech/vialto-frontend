import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { EgresosStockHistorialSuperadminPage } from './EgresosStockHistorialSuperadminPage';
import { EgresosStockHistorialTenantPage } from './EgresosStockHistorialTenantPage';

export function EgresosStockHistorialPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <CargandoVialto mensaje="Cargando egresos de stock…" />;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <EgresosStockHistorialSuperadminPage />;
  }

  return <EgresosStockHistorialTenantPage />;
}
