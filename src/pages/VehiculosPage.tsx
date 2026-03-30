import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { VehiculosSuperadminPage } from '@/pages/VehiculosSuperadminPage';
import { VehiculosTenantPage } from '@/pages/VehiculosTenantPage';

export function VehiculosPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <VehiculosSuperadminPage />;
  }

  return <VehiculosTenantPage />;
}
