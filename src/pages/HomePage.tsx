import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { SuperadminHomePage } from '@/pages/SuperadminHomePage';
import { TenantHomePage } from '@/pages/TenantHomePage';

export function HomePage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <SuperadminHomePage />;
  }

  return <TenantHomePage />;
}
