import { useAuth, useOrganization, useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import type { Tenant } from '@/types/api';

export function useCurrentTenant() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { organization } = useOrganization();
  const { user } = useUser();

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuperadmin = isPlatformSuperadmin(user?.publicMetadata);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !organization?.id || isSuperadmin) {
      setTenant(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(organization.id)}`,
          () => getToken(),
        );
        if (!cancelled) {
          setTenant(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setTenant(null);
          setError(friendlyError(e, 'plataforma'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, organization?.id, isSuperadmin]);

  return { tenant, loading, error };
}
