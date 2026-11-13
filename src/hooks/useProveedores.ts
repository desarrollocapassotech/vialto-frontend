import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";
import { QUERY_TODOS_LOS_PROVEEDORES } from "@/lib/proveedorTipo";
import type { Transportista } from "@/types/api";

/**
 * Todos los proveedores de la empresa (transportistas, talleres y otros), para Cuenta
 * corriente. Los selectores de Viajes/Choferes/Vehículos siguen con `useMaestroData`,
 * que trae solo transportistas.
 */
export function useProveedores() {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [proveedores, setProveedores] = useState<Transportista[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await apiJson<Transportista[]>(
      `/api/transportistas?${QUERY_TODOS_LOS_PROVEEDORES}`,
      () => getTokenRef.current(),
    );
    setProveedores(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelado = false;
    refresh()
      .catch(() => {
        if (!cancelado) setProveedores([]);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [refresh]);

  return { proveedores, loading, refresh };
}
