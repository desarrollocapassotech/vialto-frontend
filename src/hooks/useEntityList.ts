import { useCallback, useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';

export function useEntityList<T>(url: string, getToken: () => Promise<string | null>) {
  const [items, setItems] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiJson<T[]>(url, getToken);
      setItems(data);
    } catch (e) {
      setError(friendlyError(e, 'stock'));
    }
  }, [url, getToken]);

  useEffect(() => { void load(); }, [load]);

  return { items, error };
}