import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiJson } from '@/lib/api';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import type { PaisCodigo } from '@/lib/ciudades';
import type { Tenant } from '@/types/api';

export type TenantPaisFijoResult = {
  paisFijo: PaisCodigo | null;
  loading: boolean;
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
  const [platformTenant, setPlatformTenant] = useState<Tenant | null>(null);
  const [platformLoading, setPlatformLoading] = useState(Boolean(tenantId));

  useEffect(() => {
    if (!tenantId || !isLoaded || !isSignedIn) {
      setPlatformTenant(null);
      setPlatformLoading(Boolean(tenantId));
      return;
    }
    let cancelled = false;
    setPlatformLoading(true);
    (async () => {
      try {
        const data = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(tenantId)}`,
          () => getToken(),
        );
        if (!cancelled) setPlatformTenant(data);
      } catch {
        if (!cancelled) setPlatformTenant(null);
      } finally {
        if (!cancelled) setPlatformLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, tenantId]);

  const tenant = tenantId ? platformTenant : ownTenant;
  const loading = tenantId ? !isLoaded || platformLoading : ownTenantLoading;

  if (!tenant?.paisOrigenDestinoOculto || !tenant.paisOrigenDestinoFijoCodigo) {
    return { paisFijo: null, loading };
  }
  return { paisFijo: tenant.paisOrigenDestinoFijoCodigo, loading };
}
