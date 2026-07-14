import { useAuth, useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin, isStockViewer } from '@/lib/roleLabels';
import { StockPanelTenantPage } from './StockPanelTenantPage';

export function StockPanelPage() {
  const { user, isLoaded: userLoaded } = useUser();
  const { orgRole, isLoaded: authLoaded } = useAuth();

  if (!userLoaded || !authLoaded) {
    return <div className="text-vialto-steel py-12 text-center">Un momento…</div>;
  }

  const ctx = { orgRole, publicMetadata: user?.publicMetadata };

  // Consulta de stock: siempre inventario de su organización (nunca búsqueda de plataforma).
  if (isStockViewer(ctx)) {
    return <StockPanelTenantPage />;
  }

  // Superadmin: buscador de empresas (isPlatform) embebido en el panel.
  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return <StockPanelTenantPage isPlatform />;
  }

  return <StockPanelTenantPage />;
}
