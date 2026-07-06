import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { DestinatariosSuperadminPage } from '@/pages/DestinatariosSuperadminPage';
import { DestinatariosTenantPage } from '@/pages/DestinatariosTenantPage';

export function DestinatariosPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <DestinatariosSuperadminPage />;
  }

  return <DestinatariosTenantPage />;
}
