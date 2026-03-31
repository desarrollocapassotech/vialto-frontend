import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { PaginatedMeta, PaginatedTenantsResponse, Tenant } from '@/types/api';

const DEFAULT_META: PaginatedMeta = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
  hasPrev: false,
  hasNext: false,
};

export interface TenantsPageStats {
  total: number;
  enPrueba: number;
  activos: number;
  suspendidos: number;
  vencidos: number;
}

export function usePaginatedTenants() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [items, setItems] = useState<Tenant[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta>(DEFAULT_META);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusUpdatingByOrgId, setStatusUpdatingByOrgId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const query = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (search.trim()) {
          query.set('search', search.trim());
        }
        const res = await apiJson<PaginatedTenantsResponse>(
          `/api/tenants/paginated?${query.toString()}`,
          () => getToken(),
        );
        if (!cancelled) {
          setItems(res.items);
          setMeta(res.meta);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setItems([]);
          setMeta(DEFAULT_META);
          setError(friendlyError(e, 'plataforma'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, page, pageSize, search]);

  const stats = useMemo<TenantsPageStats>(() => {
    const enPrueba = items.filter(
      (t) => t.billingStatus.toLowerCase() === 'trial',
    ).length;
    const activos = items.filter(
      (t) => t.billingStatus.toLowerCase() === 'active',
    ).length;
    const suspendidos = items.filter(
      (t) => t.billingStatus.toLowerCase() === 'suspended',
    ).length;
    const vencidos = items.filter(
      (t) => t.billingStatus.toLowerCase() === 'expired',
    ).length;
    return { total: meta.total, enPrueba, activos, suspendidos, vencidos };
  }, [items, meta.total]);

  function applySearch() {
    setPage(1);
    setSearch(searchInput);
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
    setPage(1);
  }

  function onChangePageSize(nextSize: number) {
    setPageSize(nextSize);
    setPage(1);
  }

  async function toggleTenantEnabled(clerkOrgId: string, enabled: boolean) {
    const nextStatus = enabled ? 'active' : 'suspended';
    const previous = items;

    setStatusUpdatingByOrgId((prev) => ({ ...prev, [clerkOrgId]: true }));
    setItems((prev) =>
      prev.map((tenant) =>
        tenant.clerkOrgId === clerkOrgId
          ? { ...tenant, billingStatus: nextStatus }
          : tenant,
      ),
    );

    try {
      await apiJson(`/api/tenants/${encodeURIComponent(clerkOrgId)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({ billingStatus: nextStatus }),
      });
    } catch (e) {
      setItems(previous);
      setError(friendlyError(e, 'plataforma'));
    } finally {
      setStatusUpdatingByOrgId((prev) => ({ ...prev, [clerkOrgId]: false }));
    }
  }

  return {
    items,
    meta,
    loading,
    error,
    searchInput,
    setSearchInput,
    pageSize,
    stats,
    applySearch,
    clearSearch,
    onChangePageSize,
    statusUpdatingByOrgId,
    toggleTenantEnabled,
    prevPage: () => setPage((prev) => Math.max(1, prev - 1)),
    nextPage: () => setPage((prev) => prev + 1),
  };
}
