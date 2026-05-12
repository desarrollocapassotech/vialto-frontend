import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { ProductosTenantPage } from '@/pages/ProductosTenantPage';
import { ProductosSuperadminPage } from '@/pages/ProductosSuperadminPage';

export function ProductosPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="text-vialto-steel py-12 text-center">Un momento…</div>;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <ProductosSuperadminPage />;
  }

  return <ProductosTenantPage />;
}
