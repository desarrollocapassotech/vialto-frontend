import { useAuth, useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin, isStockViewer } from '@/lib/roleLabels';
import { StockMovimientosSuperadminPage } from './StockMovimientosSuperadminPage';
import { StockMovimientosTenantPage } from './StockMovimientosTenantPage';

export function StockMovimientosPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { orgRole, isLoaded: authLoaded } = useAuth();

  if (!userLoaded || !authLoaded) {
    return <div className="text-vialto-steel py-12 text-center">Un momento…</div>;
  }

  const ctx = { orgRole, publicMetadata: user?.publicMetadata };

  // Consulta de stock: historial de su organización (nunca búsqueda de plataforma).
  if (isStockViewer(ctx)) {
    return <StockMovimientosTenantPage />;
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <StockMovimientosSuperadminPage />;
  }

  return <StockMovimientosTenantPage />;
}
