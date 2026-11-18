import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { FacturacionTenantPage } from '@/pages/FacturacionTenantPage';
import { FacturacionSuperadminPage } from '@/pages/FacturacionSuperadminPage';

export function FacturacionPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <CargandoVialto mensaje="Cargando facturas…" />
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <FacturacionSuperadminPage />;
  }

  return <FacturacionTenantPage />;
}
