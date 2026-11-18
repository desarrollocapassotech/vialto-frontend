import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { DireccionesEntregaSuperadminPage } from '@/pages/DireccionesEntregaSuperadminPage';
import { DireccionesEntregaTenantPage } from '@/pages/DireccionesEntregaTenantPage';

export function DireccionesEntregaPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <CargandoVialto mensaje="Cargando direcciones de entrega…" />
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <DireccionesEntregaSuperadminPage />;
  }

  return <DireccionesEntregaTenantPage />;
}
