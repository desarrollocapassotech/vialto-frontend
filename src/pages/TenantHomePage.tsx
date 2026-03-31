import { useOrganization } from '@clerk/clerk-react';
import { TenantModulesGrid } from '@/components/tenant/TenantModulesGrid';
import { TenantOverviewCards } from '@/components/tenant/TenantOverviewCards';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import { labelBillingStatus } from '@/lib/platformLabels';
import { toTenantModuleCards } from '@/lib/tenantModules';

export function TenantHomePage() {
  const { organization } = useOrganization();
  const { tenant, loading, error } = useCurrentTenant();

  const moduleCards = toTenantModuleCards(tenant?.modules ?? []);

  return (
    <div className="max-w-6xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
        Inicio de empresa
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Vista adaptada a los módulos contratados por tu organización. Cada
        empresa ve un inicio diferente según sus módulos activos.
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

      <TenantOverviewCards
        loading={loading}
        subscriptionModel="Por módulos"
        billingStatus={tenant ? labelBillingStatus(tenant.billingStatus) : '—'}
        modulesCount={tenant?.modules.length ?? 0}
      />

      <section className="mt-10">
        <h2 className="font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.2em] text-vialto-fire">
          Módulos contratados
        </h2>
        {loading && (
          <p className="mt-3 text-sm text-vialto-steel">Cargando módulos…</p>
        )}
        {!loading && moduleCards.length === 0 && (
          <p className="mt-3 text-sm text-vialto-steel">
            Esta empresa todavía no tiene módulos activos.
          </p>
        )}
        {!loading && moduleCards.length > 0 && (
          <TenantModulesGrid modules={moduleCards} />
        )}
      </section>
    </div>
  );
}
