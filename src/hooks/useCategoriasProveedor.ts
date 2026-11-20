import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";

/**
 * Tipos propios de proveedor ("otro" con nombre, ej. "Combustible") que ya usó la empresa,
 * para ofrecerlos en el selector de tipo. `tenantId` = override de superadmin.
 */
export function useCategoriasProveedor(tenantId?: string): string[] {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [categorias, setCategorias] = useState<string[]>([]);

  useEffect(() => {
    let cancelado = false;
    const path = tenantId
      ? `/api/platform/transportistas/categorias?tenantId=${encodeURIComponent(tenantId)}`
      : "/api/transportistas/categorias";
    apiJson<string[]>(path, () => getTokenRef.current())
      .then((c) => !cancelado && setCategorias(c))
      .catch(() => !cancelado && setCategorias([]));
    return () => {
      cancelado = true;
    };
  }, [tenantId]);

  return categorias;
}
