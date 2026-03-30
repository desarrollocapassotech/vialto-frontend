import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import type { Tenant } from '@/types/api';

/** Lista de empresas para filtros superadmin (GET /api/tenants). */
export function useTenantsList() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [tenants, setTenants] = useState<Tenant[] | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Tenant[]>('/api/tenants', () => getToken());
        if (!cancelled) setTenants(data);
      } catch {
        if (!cancelled) setTenants([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  return tenants;
}
