import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { DestinatariosSuperadminPage } from '@/pages/DestinatariosSuperadminPage';
import { DestinatariosTenantPage } from '@/pages/DestinatariosTenantPage';

export function DestinatariosPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <CargandoVialto mensaje="Cargando destinatarios…" />
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <DestinatariosSuperadminPage />;
  }

  return <DestinatariosTenantPage />;
}
