import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import {
  labelBillingStatus,
  labelModulo,
  labelPlan,
} from '@/lib/platformLabels';
import type { Tenant } from '@/types/api';

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function SuperadminHomePage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const tenantOptions = useTenantsList();
  const [tenantDetail, setTenantDetail] = useState<Tenant | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) {
      setTenantDetail(null);
      setError(null);
      setLoadingDetail(false);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setError(null);
    (async () => {
      try {
        const t = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(filtroEmpresa)}`,
          () => getToken(),
        );
        if (!cancelled) {
          setTenantDetail(t);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setTenantDetail(null);
          setError(friendlyError(e, 'plataforma'));
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, filtroEmpresa]);

  const stats = useMemo(() => {
    const list = tenantDetail ? [tenantDetail] : [];
    const enPrueba = list.filter(
      (t) => t.billingStatus.toLowerCase() === 'trial',
    ).length;
    const activos = list.filter(
      (t) => t.billingStatus.toLowerCase() === 'active',
    ).length;
    const suspendidos = list.filter(
      (t) => t.billingStatus.toLowerCase() === 'suspended',
    ).length;
    return { total: list.length, enPrueba, activos, suspendidos };
  }, [tenantDetail]);

  const showDash =
    !filtroEmpresa || loadingDetail || (Boolean(filtroEmpresa) && error);

  return (
    <div className="max-w-6xl">
      <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl tracking-wide text-vialto-charcoal">
        Panorama general
      </h1>
      <p className="mt-2 text-vialto-steel max-w-2xl">
        Elegí una empresa para ver plan, suscripción y funciones. Los datos
        vienen del servidor según la org seleccionada.
      </p>

      <div className="mt-6">
        <EmpresaFilterBar
          tenants={tenantOptions}
          value={filtroEmpresa}
          onChange={setFiltroEmpresa}
        />
      </div>

      {error && (
        <div
          className="mt-6 rounded border border-amber-600/40 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-vialto-charcoal p-5 min-h-[120px] flex flex-col justify-between">
          <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
            Empresas
          </span>
          <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
            {showDash ? '—' : stats.total}
          </span>
        </div>
        <div className="bg-vialto-graphite p-5 min-h-[120px] flex flex-col justify-between">
          <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
            En prueba
          </span>
          <span className="font-[family-name:var(--font-display)] text-4xl text-vialto-bright tracking-wide">
            {showDash ? '—' : stats.enPrueba}
          </span>
        </div>
        <div className="bg-vialto-graphite p-5 min-h-[120px] flex flex-col justify-between">
          <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
            Al día
          </span>
          <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
            {showDash ? '—' : stats.activos}
          </span>
        </div>
        <div className="bg-vialto-graphite p-5 min-h-[120px] flex flex-col justify-between">
          <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-white/35">
            Suspendidas
          </span>
          <span className="font-[family-name:var(--font-display)] text-4xl text-white tracking-wide">
            {showDash ? '—' : stats.suspendidos}
          </span>
        </div>
      </div>

      <div className="mt-10 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Suscripción</th>
              <th className="px-4 py-3">Funciones</th>
              <th className="px-4 py-3 whitespace-nowrap">Alta</th>
            </tr>
          </thead>
          <tbody>
            {tenantOptions === null && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                  Cargando empresas…
                </td>
              </tr>
            )}
            {tenantOptions?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                  Todavía no hay empresas dadas de alta en el sistema.
                </td>
              </tr>
            )}
            {tenantOptions &&
              tenantOptions.length > 0 &&
              !filtroEmpresa && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                    Seleccioná una empresa arriba para ver el panorama.
                  </td>
                </tr>
              )}
            {filtroEmpresa && loadingDetail && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {filtroEmpresa && !loadingDetail && tenantDetail && !error && (
              <tr
                key={tenantDetail.id}
                className="border-b border-black/5 hover:bg-vialto-mist/80 align-top"
              >
                <td className="px-4 py-3 font-medium">
                  {tenantDetail.name}
                  {tenantDetail.cuit ? (
                    <span className="block text-xs font-normal text-vialto-steel mt-0.5">
                      CUIT {tenantDetail.cuit}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-vialto-steel">
                  {labelPlan(tenantDetail.plan)}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 bg-vialto-charcoal text-white">
                    {labelBillingStatus(tenantDetail.billingStatus)}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[240px]">
                  {tenantDetail.modules.length === 0 ? (
                    <span className="text-vialto-steel">Ninguna</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {tenantDetail.modules.slice(0, 4).map((m) => (
                        <span
                          key={m}
                          className="inline-block text-[11px] px-2 py-0.5 bg-vialto-mist text-vialto-charcoal rounded"
                        >
                          {labelModulo(m)}
                        </span>
                      ))}
                      {tenantDetail.modules.length > 4 ? (
                        <span className="text-xs text-vialto-steel self-center">
                          +{tenantDetail.modules.length - 4}
                        </span>
                      ) : null}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-vialto-steel whitespace-nowrap">
                  {formatDate(tenantDetail.createdAt)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
