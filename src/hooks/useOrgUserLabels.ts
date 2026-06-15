import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '@/lib/api';
import { buildUserLabelMap, type OrgUserRef } from '@/lib/clerkUserLabels';

const cache = new Map<string, OrgUserRef[]>();
const inflight = new Map<string, Promise<OrgUserRef[]>>();

async function fetchOrgUsers(
  cacheKey: string,
  path: string,
  getToken: () => Promise<string | null>,
): Promise<OrgUserRef[]> {
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const promise = apiJson<OrgUserRef[]>(path, getToken)
    .then((data) => {
      const users = data ?? [];
      cache.set(cacheKey, users);
      inflight.delete(cacheKey);
      return users;
    })
    .catch(() => {
      inflight.delete(cacheKey);
      return [] as OrgUserRef[];
    });

  inflight.set(cacheKey, promise);
  return promise;
}

/** Mapa userId → nombre visible para usuarios de la organización activa (o tenant en superadmin). */
export function useOrgUserLabels(tenantId?: string) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [users, setUsers] = useState<OrgUserRef[]>([]);

  const cacheKey = tenantId?.trim() || '__tenant__';
  const path = tenantId?.trim()
    ? `/api/platform/users?tenantId=${encodeURIComponent(tenantId.trim())}`
    : '/api/users';

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    void fetchOrgUsers(cacheKey, path, getToken).then((data) => {
      if (!cancelled) setUsers(data);
    });
    return () => {
      cancelled = true;
    };
  }, [cacheKey, getToken, isLoaded, isSignedIn, path]);

  return useMemo(() => buildUserLabelMap(users), [users]);
}
