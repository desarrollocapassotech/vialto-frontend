import { useAuth, useOrganization } from '@clerk/clerk-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiJson } from '@/lib/api';
import type { DashboardPeriodKind, OwnerDashboardResponse } from '@/types/ownerDashboard';

function buildQuery(
  period: DashboardPeriodKind,
  customFrom: string,
  customTo: string,
): string {
  const params = new URLSearchParams({ period });
  if (period === 'custom' && customFrom && customTo) {
    params.set('from', customFrom);
    params.set('to', customTo);
  }
  return `/api/dashboard/resumen?${params.toString()}`;
}

export function useTenantOwnerDashboard() {
  const { organization } = useOrganization();
  const orgReady = Boolean(organization?.id);
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const [period, setPeriod] = useState<DashboardPeriodKind>('month');
  const [customFrom, setCustomFrom] = useState('2001-01-01');
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<OwnerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isLoaded || !isSignedIn || !orgReady) return;
    if (period === 'custom' && (!customFrom || !customTo)) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const path = buildQuery(period, customFrom, customTo);
      const res = await apiJson<OwnerDashboardResponse>(
        path,
        () => getTokenRef.current(),
      );
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'No se pudo cargar el panel');
    } finally {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, orgReady, period, customFrom, customTo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    period,
    setPeriod,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    data,
    loading,
    error,
    refresh,
  };
}
