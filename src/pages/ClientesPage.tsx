import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { ClientesSuperadminPage } from '@/pages/ClientesSuperadminPage';
import { ClientesTenantPage } from '@/pages/ClientesTenantPage';

export function ClientesPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <CargandoVialto mensaje="Cargando clientes…" />
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <ClientesSuperadminPage />;
  }

  return <ClientesTenantPage />;
}
