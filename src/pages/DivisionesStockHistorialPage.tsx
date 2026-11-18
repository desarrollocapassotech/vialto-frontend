import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { DivisionesStockHistorialTenantPage } from "./DivisionesStockHistorialTenantPage";

export function DivisionesStockHistorialPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <CargandoVialto mensaje="Cargando divisiones de stock…" />;
  }

  const isSuperadmin = isPlatformSuperadmin(user?.publicMetadata);

  return <DivisionesStockHistorialTenantPage isPlatform={isSuperadmin} />;
}
