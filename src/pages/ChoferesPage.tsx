import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { ChoferesSuperadminPage } from '@/pages/ChoferesSuperadminPage';
import { ChoferesTenantPage } from '@/pages/ChoferesTenantPage';

export function ChoferesPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <CargandoVialto mensaje="Cargando choferes…" />
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <ChoferesSuperadminPage />;
  }

  return <ChoferesTenantPage />;
}
