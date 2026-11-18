import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { ProductosTenantPage } from '@/pages/ProductosTenantPage';
import { ProductosSuperadminPage } from '@/pages/ProductosSuperadminPage';

export function ProductosPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <CargandoVialto mensaje="Cargando productos…" />;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <ProductosSuperadminPage />;
  }

  return <ProductosTenantPage />;
}
