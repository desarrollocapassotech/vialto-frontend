import { useUser } from "@clerk/clerk-react";
import { isPlatformSuperadmin } from "@/lib/roleLabels";
import { CombustibleTenantPage } from "@/pages/CombustibleTenantPage";
import { CombustibleSuperadminPage } from "@/pages/CombustibleSuperadimPage";

export function CombustiblePage() {
  const { user } = useUser();
  const isSuperadmin = isPlatformSuperadmin(user?.publicMetadata);

  if (isSuperadmin) {
    return <CombustibleSuperadminPage />;
  }

  return <CombustibleTenantPage />;
}
