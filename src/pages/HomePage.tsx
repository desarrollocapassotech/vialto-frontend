import { useAuth, useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';
import { useMaestroData } from '@/hooks/useMaestroData';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { dashboardHabilitado, primeraRutaModulo } from '@/lib/tenantHome';
import { SuperadminHomePage } from '@/pages/SuperadminHomePage';
import { TenantHomePage } from '@/pages/TenantHomePage';

export function HomePage() {
  const { user, isLoaded } = useUser();
  const { orgRole } = useAuth();
  const { tenant, tenantLoading } = useMaestroData();

  if (!isLoaded) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <SuperadminHomePage />;
  }

  // Sin dashboard (configurado por superadmin): el inicio es el primer módulo contratado.
  // Se espera al tenant para no mostrar el dashboard un instante antes de redirigir.
  if (tenantLoading) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }
  if (tenant && !dashboardHabilitado(tenant)) {
    const ruta = primeraRutaModulo(tenant.modules, {
      orgRole,
      publicMetadata: user?.publicMetadata,
    });
    if (ruta) return <Navigate to={ruta} replace />;
  }

  return <TenantHomePage />;
}
