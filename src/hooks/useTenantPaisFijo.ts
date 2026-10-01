import { useAuth } from '@clerk/clerk-react';
import useSWR from 'swr';
import { apiJson } from '@/lib/api';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import type { PaisCodigo } from '@/lib/ciudades';
import type { Tenant } from '@/types/api';

export type TenantPaisFijoResult = {
  paisFijo: PaisCodigo | null;
  loading: boolean;
  /**
   * Tenant efectivo ya resuelto (propio u override de superadmin), para leer
   * otros flags de empresa sin volver a pedirlo — ej. `validacionCuitArcaHabilitada`.
   */
  tenant: Tenant | null;
};

/**
 * Código de país fijo del tenant (`Tenant.paisOrigenDestinoOculto` +
 * `paisOrigenDestinoFijoCodigo`, resuelto por el backend) — mismo flag que
 * oculta/fija el país en Viajes, reusado acá para Cliente y Transportista
 * (ver `CamposEmpresaPage.tsx`, pestaña Viajes → "Ocultar país de
 * origen/destino"). Devuelve `paisFijo: null` si el toggle está apagado o no
 * se eligió país fijo — en ese caso el selector de país sigue mostrándose
 * normal. Devuelve además `loading`, que hay que respetar en el cálculo de
 * visibilidad del selector para evitar que se muestre brevemente mientras
 * se resuelve el tenant (ver VTO-366).
 *
 * `tenantId` es el override de superadmin (query param `?tenantId=`, cuando
 * se opera "en nombre de" un tenant elegido) — sin él, se usa el tenant de la
 * organización de Clerk activa.
 */
export function useTenantPaisFijo(tenantId?: string): TenantPaisFijoResult {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { tenant: ownTenant, loading: ownTenantLoading } = useCurrentTenant();

  const shouldFetchPlatform = Boolean(tenantId && isLoaded && isSignedIn);

  const { data: platformTenant, isLoading: platformLoading } = useSWR<Tenant>(
    shouldFetchPlatform ? `/api/tenants/${encodeURIComponent(tenantId!)}` : null,
    async (url: string) => apiJson<Tenant>(url, () => getToken())
  );

  const tenant = tenantId ? (platformTenant ?? null) : ownTenant;
  const loading = tenantId ? !isLoaded || platformLoading : ownTenantLoading;

  if (!tenant?.paisOrigenDestinoOculto || !tenant.paisOrigenDestinoFijoCodigo) {
    return { paisFijo: null, loading, tenant };
  }
  return { paisFijo: tenant.paisOrigenDestinoFijoCodigo, loading, tenant };
}
