import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { PaisesSuperadminPage } from '@/pages/PaisesSuperadminPage';
import { PaisesTenantPage } from '@/pages/PaisesTenantPage';

export function PaisesPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <CargandoVialto mensaje="Cargando países…" />
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <PaisesSuperadminPage />;
  }

  return <PaisesTenantPage />;
}