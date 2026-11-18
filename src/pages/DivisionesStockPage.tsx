import { useUser } from "@clerk/clerk-react";
import { isPlatformSuperadmin } from "@/lib/roleLabels";
import { DivisionesStockSuperadminPage } from "./DivisionesStockSuperadminPage";
import { DivisionesStockTenantPage } from "./DivisionesStockTenantPage";

export function DivisionesStockPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="py-12 text-center text-vialto-steel">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <DivisionesStockSuperadminPage />;
  }

  return <DivisionesStockTenantPage />;
}
