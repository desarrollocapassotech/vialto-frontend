import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { PresentacionesTenantPage } from '@/pages/PresentacionesTenantPage';
import { PresentacionesSuperadminPage } from '@/pages/PresentacionesSuperadminPage';

export function PresentacionesPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="text-vialto-steel py-12 text-center">Un momento…</div>;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <PresentacionesSuperadminPage />;
  }

  return <PresentacionesTenantPage />;
}
