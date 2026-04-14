import { useOrganization } from '@clerk/clerk-react';
import { TenantOwnerDashboard } from '@/components/tenant/TenantOwnerDashboard';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';

export function TenantHomePage() {
  const { organization } = useOrganization();
  const { tenant, loading, error } = useCurrentTenant();
  const companyName = tenant?.name?.trim() || organization?.name?.trim() || 'empresa';

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
        Panel de {companyName}
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Indicadores clave para la gestión de tu empresa: cobranzas, riesgos y
        actividad según los módulos contratados.
      </p>

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
        <TenantOwnerDashboard modules={tenant.modules} />
      )}
    </div>
  );
}
