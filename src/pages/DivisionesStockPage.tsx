import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from "@clerk/clerk-react";
import { isPlatformSuperadmin } from "@/lib/roleLabels";
import { DivisionesStockSuperadminPage } from "./DivisionesStockSuperadminPage";
import { DivisionesStockTenantPage } from "./DivisionesStockTenantPage";

export function DivisionesStockPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <CargandoVialto mensaje="Preparando la división de stock…" />
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <DivisionesStockSuperadminPage />;
  }

  return <DivisionesStockTenantPage />;
}
