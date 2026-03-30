import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { ViajesSuperadminPage } from '@/pages/ViajesSuperadminPage';
import { ViajesTenantPage } from '@/pages/ViajesTenantPage';

export function ViajesPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <ViajesSuperadminPage />;
  }

  return <ViajesTenantPage />;
}
