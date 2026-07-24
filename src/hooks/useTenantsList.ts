import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import type { Tenant } from "@/types/api";

/** Lista de empresas para filtros superadmin (GET /api/tenants). */
export function useTenantsList(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [tenants, setTenants] = useState<Tenant[] | null>(null);

  useEffect(() => {
    if (!enabled) {
      setTenants(null);
      return;
    }
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<Tenant[]>("/api/tenants", () => getToken());
        if (!cancelled) setTenants(data);
      } catch {
        if (!cancelled) setTenants([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, getToken, isLoaded, isSignedIn]);

  return tenants;
}
