import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { PaisesSuperadminPage } from '@/pages/PaisesSuperadminPage';
import { PaisesTenantPage } from '@/pages/PaisesTenantPage';

export function PaisesPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <PaisesSuperadminPage />;
  }

  return <PaisesTenantPage />;
}