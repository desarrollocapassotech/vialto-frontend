import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TenantsStatsCards } from '@/components/superadmin/TenantsStatsCards';
import { useTenantsList } from '@/hooks/useTenantsList';
import { SuperadminOnly } from '@/components/superadmin/SuperadminOnly';

const EXPIRING_WINDOW_DAYS = 30;

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha invalida';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function SuperadminHomePage() {
  const tenants = useTenantsList();
  const loadingStats = tenants === null;

  const stats = useMemo(() => {
    const rows = tenants ?? [];
    return {
      total: rows.length,
      enPrueba: rows.filter((t) => t.billingStatus.toLowerCase() === 'trial').length,
      activos: rows.filter((t) => t.billingStatus.toLowerCase() === 'active').length,
      suspendidos: rows.filter((t) => t.billingStatus.toLowerCase() === 'suspended').length,
      vencidos: rows.filter((t) => t.billingStatus.toLowerCase() === 'expired').length,
    };
  }, [tenants]);

  const trialTenants = useMemo(
    () =>
      (tenants ?? [])
        .filter((t) => t.billingStatus.toLowerCase() === 'trial')
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [tenants],
  );

  const suspendedTenants = useMemo(
    () =>
      (tenants ?? [])
        .filter((t) => t.billingStatus.toLowerCase() === 'suspended')
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [tenants],
  );

  const expiredTenants = useMemo(
    () =>
      (tenants ?? [])
        .filter((t) => t.billingStatus.toLowerCase() === 'expired')
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [tenants],
  );

  const expiringSoonTenants = useMemo(() => {
    const now = new Date();
    const max = new Date(now);
    max.setDate(max.getDate() + EXPIRING_WINDOW_DAYS);

    return (tenants ?? [])
      .filter((t) => {
        if (!t.billingRenewsAt) return false;
        if (t.billingStatus.toLowerCase() === 'suspended') return false;
        const renewDate = new Date(t.billingRenewsAt);
        if (Number.isNaN(renewDate.getTime())) return false;
        return renewDate >= now && renewDate <= max;
      })
      .map((t) => {
        const renewDate = new Date(t.billingRenewsAt as string);
        const daysLeft = Math.ceil(
          (renewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        return { ...t, daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [tenants]);

  return (
    <SuperadminOnly>
      <div className="w-full">
        <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
          Panorama general
        </h1>
        <p className="mt-2 text-vialto-steel max-w-2xl">
          Accesos rápidos para gestionar empresas y operación de la plataforma.
        </p>
        <TenantsStatsCards
          loading={loadingStats}
          stats={stats}
          empresasLinkTo="/superadmin/empresas"
        />

        <div className="mt-8 grid gap-4 lg:grid-cols-4">
          <section className="rounded border border-black/10 bg-white">
            <header className="px-4 py-3 border-b border-black/10">
              <h2 className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
                Empresas en prueba
              </h2>
            </header>
            <div className="p-4">
              {loadingStats && <p className="text-sm text-vialto-steel">Cargando…</p>}
              {!loadingStats && trialTenants.length === 0 && (
                <p className="text-sm text-vialto-steel">No hay empresas en prueba.</p>
              )}
              {!loadingStats && trialTenants.length > 0 && (
                <ul className="space-y-2">
                  {trialTenants.map((tenant) => (
                    <li key={tenant.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-vialto-charcoal">{tenant.name}</span>
                      <Link
                        to={`/superadmin/empresas/${encodeURIComponent(tenant.clerkOrgId)}/editar`}
                        className="text-xs uppercase tracking-wider px-2 py-1 border border-black/15 hover:bg-vialto-mist"
                      >
                        Ver
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded border border-black/10 bg-white">
            <header className="px-4 py-3 border-b border-black/10">
              <h2 className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
                Empresas suspendidas
              </h2>
            </header>
            <div className="p-4">
              {loadingStats && <p className="text-sm text-vialto-steel">Cargando…</p>}
              {!loadingStats && suspendedTenants.length === 0 && (
                <p className="text-sm text-vialto-steel">No hay empresas suspendidas.</p>
              )}
              {!loadingStats && suspendedTenants.length > 0 && (
                <ul className="space-y-2">
                  {suspendedTenants.map((tenant) => (
                    <li key={tenant.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-vialto-charcoal">{tenant.name}</span>
                      <Link
                        to={`/superadmin/empresas/${encodeURIComponent(tenant.clerkOrgId)}/editar`}
                        className="text-xs uppercase tracking-wider px-2 py-1 border border-black/15 hover:bg-vialto-mist"
                      >
                        Ver
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded border border-black/10 bg-white">
            <header className="px-4 py-3 border-b border-black/10">
              <h2 className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
                Empresas vencidas
              </h2>
            </header>
            <div className="p-4">
              {loadingStats && <p className="text-sm text-vialto-steel">Cargando…</p>}
              {!loadingStats && expiredTenants.length === 0 && (
                <p className="text-sm text-vialto-steel">No hay empresas vencidas.</p>
              )}
              {!loadingStats && expiredTenants.length > 0 && (
                <ul className="space-y-2">
                  {expiredTenants.map((tenant) => (
                    <li key={tenant.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-vialto-charcoal">{tenant.name}</span>
                      <Link
                        to={`/superadmin/empresas/${encodeURIComponent(tenant.clerkOrgId)}/editar`}
                        className="text-xs uppercase tracking-wider px-2 py-1 border border-black/15 hover:bg-vialto-mist"
                      >
                        Ver
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded border border-black/10 bg-white">
            <header className="px-4 py-3 border-b border-black/10">
              <h2 className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
                Proximas a vencer
              </h2>
            </header>
            <div className="p-4">
              {loadingStats && <p className="text-sm text-vialto-steel">Cargando…</p>}
              {!loadingStats && expiringSoonTenants.length === 0 && (
                <p className="text-sm text-vialto-steel">
                  No hay renovaciones en los proximos {EXPIRING_WINDOW_DAYS} dias.
                </p>
              )}
              {!loadingStats && expiringSoonTenants.length > 0 && (
                <ul className="space-y-2">
                  {expiringSoonTenants.map((tenant) => (
                    <li key={tenant.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-vialto-charcoal truncate">{tenant.name}</p>
                        <p className="text-xs text-vialto-steel">
                          {formatDate(tenant.billingRenewsAt)} · {tenant.daysLeft} dias
                        </p>
                      </div>
                      <Link
                        to={`/superadmin/empresas/${encodeURIComponent(tenant.clerkOrgId)}/editar`}
                        className="text-xs uppercase tracking-wider px-2 py-1 border border-black/15 hover:bg-vialto-mist"
                      >
                        Ver
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </SuperadminOnly>
  );
}
