import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { DivisionesStockHistorialTenantPage } from "./DivisionesStockHistorialTenantPage";

export function DivisionesStockHistorialPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="text-vialto-steel py-12 text-center">Un momento…</div>;
  }

  const isSuperadmin = isPlatformSuperadmin(user?.publicMetadata);

  return <DivisionesStockHistorialTenantPage isPlatform={isSuperadmin} />;
}
