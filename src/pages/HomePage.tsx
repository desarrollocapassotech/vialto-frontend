import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { DashboardPage } from '@/pages/DashboardPage';
import { SuperadminHomePage } from '@/pages/SuperadminHomePage';

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

  return <DashboardPage />;
}
