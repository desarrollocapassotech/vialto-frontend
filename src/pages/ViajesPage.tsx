import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { ViajesSuperadminPage } from '@/pages/ViajesSuperadminPage';
import { ViajesTenantPage } from '@/pages/ViajesTenantPage';

export function ViajesPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <CargandoVialto mensaje="Cargando viajes…" />
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <ViajesSuperadminPage />;
  }

  return <ViajesTenantPage />;
}
