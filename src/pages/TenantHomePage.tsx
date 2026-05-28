import { useAuth, useOrganization } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TenantOwnerDashboard, AlertsPanel } from '@/components/tenant/TenantOwnerDashboard';
import { FacturaViewModal } from '@/components/facturacion/FacturaViewModal';
import { ViajeViewModal } from '@/components/viajes/ViajeViewModal';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import { useTenantOwnerDashboard } from '@/hooks/useTenantOwnerDashboard';
import { apiJson } from '@/lib/api';
import { canAccessFacturacion } from '@/lib/tenantModules';
import type { Factura, Viaje } from '@/types/api';

export function TenantHomePage() {
  const { getToken } = useAuth();
  const { organization } = useOrganization();
  const navigate = useNavigate();
  const { tenant, loading, error } = useCurrentTenant();
  const dash = useTenantOwnerDashboard();
  const [viewingFactura, setViewingFactura] = useState<Factura | null>(null);
  const [loadingFacturaId, setLoadingFacturaId] = useState<string | null>(null);
  const [viewingViaje, setViewingViaje] = useState<Viaje | null>(null);
  const [loadingViajeId, setLoadingViajeId] = useState<string | null>(null);

  async function handleViewFactura(id: string) {
    setLoadingFacturaId(id);
    try {
      const factura = await apiJson<Factura>(`/api/facturacion/facturas/${encodeURIComponent(id)}`, () => getToken());
      setViewingFactura(factura);
    } catch {
      // silencioso
    } finally {
      setLoadingFacturaId(null);
    }
  }

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
        </div>

        {showAlertsBlock && alertas && (
          <AlertsPanel
            alertas={alertas}
            onViewFactura={(id) => void handleViewFactura(id)}
            loadingFacturaId={loadingFacturaId}
            onViewViaje={(id) => void handleViewViaje(id)}
            loadingViajeId={loadingViajeId}
            shouldClose={viewingFactura !== null || viewingViaje !== null}
          />
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

      {viewingFactura && (
        <FacturaViewModal
          factura={viewingFactura}
          onClose={() => setViewingFactura(null)}
          onEditar={() => {
            const id = viewingFactura.id;
            setViewingFactura(null);
            navigate('/facturacion', { state: { expandFacturaId: id } });
          }}
        />
      )}

      {viewingViaje && (
        <ViajeViewModal
          viaje={viewingViaje}
          onClose={() => setViewingViaje(null)}
          onEditar={() => {
            const id = viewingViaje.id;
            setViewingViaje(null);
            navigate(`/viajes?viaje=${encodeURIComponent(id)}`);
          }}
        />
      )}
    </div>
  );
}
