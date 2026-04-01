import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { TransportistasSuperadminPage } from '@/pages/TransportistasSuperadminPage';
import { TransportistasTenantPage } from '@/pages/TransportistasTenantPage';

export function TransportistasPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="text-vialto-steel py-12 text-center">Un momento…</div>;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <TransportistasSuperadminPage />;
  }

  return <TransportistasTenantPage />;
}
