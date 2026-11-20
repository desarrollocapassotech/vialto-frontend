import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { TransportistasSuperadminPage } from '@/pages/TransportistasSuperadminPage';
import { TransportistasTenantPage } from '@/pages/TransportistasTenantPage';

export function TransportistasPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <CargandoVialto mensaje="Cargando proveedores…" />;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <TransportistasSuperadminPage />;
  }

  return <TransportistasTenantPage />;
}
