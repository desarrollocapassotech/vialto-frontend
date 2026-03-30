import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { ClientesSuperadminPage } from '@/pages/ClientesSuperadminPage';
import { ClientesTenantPage } from '@/pages/ClientesTenantPage';

export function ClientesPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <ClientesSuperadminPage />;
  }

  return <ClientesTenantPage />;
}
