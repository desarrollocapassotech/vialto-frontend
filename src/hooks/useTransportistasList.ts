import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import type { Transportista } from '@/types/api';

/**
 * Lista de transportistas del tenant actual (`/api/transportistas`), o de una empresa
 * (`platformTenantId` = clerkOrgId de `/api/platform/transportistas`).
 * @param skipFetch Si es true, no pide la lista (p. ej. superadmin sin empresa elegida).
 */
export function useTransportistasList(platformTenantId?: string, skipFetch?: boolean) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [transportistas, setTransportistas] = useState<Transportista[] | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (skipFetch) {
      setTransportistas(null);
      return;
    }
    let cancelled = false;
    const tid = platformTenantId?.trim();
    const path = tid
      ? `/api/platform/transportistas?tenantId=${encodeURIComponent(tid)}`
      : '/api/transportistas';
    (async () => {
      try {
        const data = await apiJson<Transportista[]>(path, () => getToken());
        if (!cancelled) setTransportistas(data);
      } catch {
        if (!cancelled) setTransportistas([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, platformTenantId, skipFetch]);

  return transportistas;
}
