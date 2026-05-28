import { useAuth, useOrganization } from '@clerk/clerk-react';
import { useState } from 'react';
import { TenantOwnerDashboard, AlertsPanel } from '@/components/tenant/TenantOwnerDashboard';
import { ViajeViewModal } from '@/components/viajes/ViajeViewModal';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import { useTenantOwnerDashboard } from '@/hooks/useTenantOwnerDashboard';
import { apiJson } from '@/lib/api';
import { canAccessFacturacion } from '@/lib/tenantModules';
import type { Viaje } from '@/types/api';

export function TenantHomePage() {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const { tenant, loading, error } = useCurrentTenant();
  const dash = useTenantOwnerDashboard();
  const [viewingViaje, setViewingViaje] = useState<Viaje | null>(null);
  const [loadingViajeId, setLoadingViajeId] = useState<string | null>(null);

  async function handleViewViaje(id: string) {
    setLoadingViajeId(id);
    try {
      const viaje = await apiJson<Viaje>(`/api/viajes/${encodeURIComponent(id)}`, () => getToken());
      setViewingViaje(viaje);
    } catch {
      // silencioso
    } finally {
      setLoadingViajeId(null);
    }
  }

  const companyName = tenant?.name?.trim() || organization?.name?.trim() || 'empresa';

  const alertas = dash.data?.alertas;
  const showAlertsBlock =
    tenant != null &&
    canAccessFacturacion(tenant.modules) &&
    alertas != null &&
    (alertas.facturasVencidas.cantidad > 0 || alertas.viajesSinFactura.cantidad > 0);

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
            Panel de {companyName}
          </h1>
          <p className="mt-2 text-vialto-steel max-w-xl">
            Indicadores clave para la gestión de tu empresa.
          </p>
        </div>

        {showAlertsBlock && alertas && (
          <AlertsPanel alertas={alertas} onViewViaje={(id) => void handleViewViaje(id)} loadingViajeId={loadingViajeId} shouldClose={viewingViaje !== null} />
        )}
      </div>

      {!organization && (
        <div
          className="mt-6 rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          Elegí una empresa para cargar el inicio con sus módulos contratados.
        </div>
      )}

      {error && (
        <div
          className="mt-6 rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {error}
        </div>
      )}

      {organization && loading && !error && (
        <p className="mt-6 text-sm text-vialto-steel">Cargando datos de tu empresa…</p>
      )}

      {organization && !loading && !error && tenant && (
        <TenantOwnerDashboard modules={tenant.modules} dash={dash} />
      )}

      {viewingViaje && (
        <ViajeViewModal
          viaje={viewingViaje}
          onClose={() => setViewingViaje(null)}
          onEditar={() => setViewingViaje(null)}
        />
      )}
    </div>
  );
}
