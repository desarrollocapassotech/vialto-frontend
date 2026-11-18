import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { PresentacionesTenantPage } from '@/pages/PresentacionesTenantPage';
import { PresentacionesSuperadminPage } from '@/pages/PresentacionesSuperadminPage';

export function PresentacionesPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return <CargandoVialto mensaje="Cargando presentaciones…" />;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <PresentacionesSuperadminPage />;
  }

  return <PresentacionesTenantPage />;
}
