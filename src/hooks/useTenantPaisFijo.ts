import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiJson } from '@/lib/api';
import { useCurrentTenant } from '@/hooks/useCurrentTenant';
import type { PaisCodigo } from '@/lib/ciudades';
import type { Tenant } from '@/types/api';

/**
 * Código de país fijo del tenant (`Tenant.paisOrigenDestinoOculto` +
 * `paisOrigenDestinoFijoCodigo`, resuelto por el backend) — mismo flag que
 * oculta/fija el país en Viajes, reusado acá para Cliente y Transportista
 * (ver `CamposEmpresaPage.tsx`, pestaña Viajes → "Ocultar país de
 * origen/destino"). Devuelve `null` si el toggle está apagado o no se eligió
 * país fijo — en ese caso el selector de país sigue mostrándose normal.
 *
 * `tenantId` es el override de superadmin (query param `?tenantId=`, cuando
 * se opera "en nombre de" un tenant elegido) — sin él, se usa el tenant de la
 * organización de Clerk activa.
 */
export function useTenantPaisFijo(tenantId?: string): PaisCodigo | null {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { tenant: ownTenant } = useCurrentTenant();
  const [platformTenant, setPlatformTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    if (!tenantId || !isLoaded || !isSignedIn) {
      setPlatformTenant(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(tenantId)}`,
          () => getToken(),
        );
        if (!cancelled) setPlatformTenant(data);
      } catch {
        if (!cancelled) setPlatformTenant(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, tenantId]);

  const tenant = tenantId ? platformTenant : ownTenant;
  if (!tenant?.paisOrigenDestinoOculto || !tenant.paisOrigenDestinoFijoCodigo) {
    return null;
  }
  return tenant.paisOrigenDestinoFijoCodigo;
}
