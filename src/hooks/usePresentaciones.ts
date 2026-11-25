import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { apiJson } from '@/lib/api';
import type { Presentacion } from '@/types/api';

export function usePresentaciones(tenantId?: string, enabled: boolean = true) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPresentaciones = useCallback(async () => {
    if (!enabled || !isLoaded || !isSignedIn) return;
    setLoading(true);
    try {
      const url = tenantId
        ? `/api/platform/stock/presentaciones?tenantId=${encodeURIComponent(tenantId)}&activo=1`
        : `/api/stock/presentaciones?activo=1`;
      const data = await apiJson<Presentacion[]>(url, () => getToken());
      setPresentaciones(data ?? []);
    } catch {
      setPresentaciones([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, getToken, isLoaded, isSignedIn, tenantId]);

  useEffect(() => {
    fetchPresentaciones();
  }, [fetchPresentaciones]);

  const agregarPresentacion = useCallback((nueva: Presentacion) => {
    setPresentaciones((prev) => {
      if (prev.some((p) => p.id === nueva.id)) return prev;
      return [...prev, nueva];
    });
  }, []);

  return {
    presentaciones,
    loading,
    refresh: fetchPresentaciones,
    agregarPresentacion,
  };
}
