import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { VehiculosSuperadminPage } from '@/pages/VehiculosSuperadminPage';
import { VehiculosTenantPage } from '@/pages/VehiculosTenantPage';

export function VehiculosPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <CargandoVialto mensaje="Cargando vehículos…" />
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <VehiculosSuperadminPage />;
  }

  return <VehiculosTenantPage />;
}
