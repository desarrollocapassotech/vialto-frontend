import { useOrganization } from '@clerk/clerk-react';
import { TenantOverviewCards } from '@/components/tenant/TenantOverviewCards';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import { labelBillingStatus } from '@/lib/platformLabels';

export function TenantHomePage() {
  const { organization } = useOrganization();
  const { tenant, loading, error } = useCurrentTenant();
  const companyName = tenant?.name?.trim() || organization?.name?.trim() || 'empresa';

  return (
    <div className="max-w-6xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
        Panel de {companyName}
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Vista adaptada a los módulos contratados por tu organización.
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
        billingStatus={tenant ? labelBillingStatus(tenant.billingStatus) : '—'}
        modulesCount={tenant?.modules.length ?? 0}
      />
    </div>
  );
}
