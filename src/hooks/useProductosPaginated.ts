import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { buildQs } from '@/lib/queryString';
import type { Producto } from '@/types/api';

export function useProductosPaginated(productosBase: string, tenantId: string | undefined, getToken: () => Promise<string | null>) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const url = `${productosBase}/paginated${buildQs(
        { page: '1', pageSize: '100', filtroActivo: 'activos' },
        tenantId,
      )}`;
      const data = await apiJson<{ items: Producto[] }>(url, getToken);
      setProductos(data.items);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    }
  }, [productosBase, tenantId, getToken]);

  useEffect(() => { void load(); }, [load]);

  return { productos, error };
}