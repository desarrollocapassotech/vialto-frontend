import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { DireccionesEntregaSuperadminPage } from '@/pages/DireccionesEntregaSuperadminPage';
import { DireccionesEntregaTenantPage } from '@/pages/DireccionesEntregaTenantPage';

export function DireccionesEntregaPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <DireccionesEntregaSuperadminPage />;
  }

  return <DireccionesEntregaTenantPage />;
}
