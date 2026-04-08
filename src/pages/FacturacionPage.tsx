import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { FacturacionTenantPage } from '@/pages/FacturacionTenantPage';
import { FacturacionSuperadminPage } from '@/pages/FacturacionSuperadminPage';

export function FacturacionPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <FacturacionSuperadminPage />;
  }

  return <FacturacionTenantPage />;
}
