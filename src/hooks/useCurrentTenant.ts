import { useAuth, useOrganization, useUser } from '@clerk/clerk-react';
import useSWR from 'swr';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import type { Tenant } from '@/types/api';

export function useCurrentTenant() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const { user } = useUser();

  const isSuperadmin = isPlatformSuperadmin(user?.publicMetadata);
  const shouldFetch = isLoaded && isSignedIn && organization?.id && !isSuperadmin;

  const { data, isLoading, error } = useSWR<Tenant>(
    shouldFetch ? `/api/tenants/${encodeURIComponent(organization.id)}` : null,
    async (url: string) => apiJson<Tenant>(url, () => getToken())
  );

  return {
    tenant: data ?? null,
    loading: isLoading,
    error: error ? friendlyError(error, 'plataforma') : null,
  };
}
