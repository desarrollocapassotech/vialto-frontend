import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { useAuth, useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin, isStockViewer } from '@/lib/roleLabels';
import { StockMovimientosSuperadminPage } from './StockMovimientosSuperadminPage';
import { StockMovimientosTenantPage } from './StockMovimientosTenantPage';

export function StockMovimientosPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { orgRole, isLoaded: authLoaded } = useAuth();

  if (!userLoaded || !authLoaded) {
    return <CargandoVialto mensaje="Cargando movimientos de stock…" />;
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
