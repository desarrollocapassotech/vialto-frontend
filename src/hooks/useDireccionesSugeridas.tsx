import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import useSWR from "swr";
import { apiJson } from "@/lib/api";
import type { DireccionEntrega } from "@/types/api";

/**
 * Direcciones de entrega de la empresa (Base de datos → Direcciones de entrega)
 * para sugerir en Origen/Destino de un viaje, junto con las ciudades del buscador
 * (ver `CiudadCombobox`). Solo las ven los campos dentro de un
 * `DireccionesSugeridasProvider`: hoy, el alta y la edición de viajes. Sin
 * provider (filtros de grilla, otros formularios) la lista es vacía.
 */
const DireccionesSugeridasContext = createContext<string[]>([]);

/**
 * `tenantId` = override de superadmin (empresa elegida): usa la ruta de
 * plataforma. Sin él, las direcciones de la empresa logueada.
 */
export function DireccionesSugeridasProvider({
  tenantId,
  children,
}: {
  tenantId?: string;
  children: ReactNode;
}) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const url = !isLoaded || !isSignedIn
    ? null
    : tenantId
      ? `/api/platform/direcciones-entrega?tenantId=${encodeURIComponent(tenantId)}`
      : "/api/direcciones-entrega";
  const { data } = useSWR<DireccionEntrega[]>(url, async (u: string) => {
    // La ruta devuelve un array; se tolera también { items } / { data } (paginado).
    const r = await apiJson<
      DireccionEntrega[] | { items?: DireccionEntrega[]; data?: DireccionEntrega[] }
    >(u, () => getToken());
    return Array.isArray(r) ? r : (r.items ?? r.data ?? []);
  });
  const direcciones = useMemo(() => {
    const vistas = new Set<string>();
    const out: string[] = [];
    for (const d of data ?? []) {
      const t = d.direccion?.trim();
      if (!t || vistas.has(t.toLowerCase())) continue;
      vistas.add(t.toLowerCase());
      out.push(t);
    }
    return out;
  }, [data]);
  return (
    <DireccionesSugeridasContext.Provider value={direcciones}>
      {children}
    </DireccionesSugeridasContext.Provider>
  );
}

export function useDireccionesSugeridas(): string[] {
  return useContext(DireccionesSugeridasContext);
}
