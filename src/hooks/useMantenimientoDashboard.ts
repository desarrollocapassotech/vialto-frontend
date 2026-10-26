import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";
import { mantUrl } from "@/lib/mantenimientoApi";
import type { EstadoVencimiento, FilaVencimiento } from "@/types/mantenimiento";

/**
 * Datos de la pestaña Mantenimiento del panel de inicio: el semáforo completo
 * (`GET mantenimiento/vencimientos`, ya ordenado vencido → próximo → sin datos → ok).
 * No depende del período del panel. `activo = false` no pide nada.
 */
export function useMantenimientoDashboard(activo: boolean) {
  const { getToken } = useAuth();
  const [filas, setFilas] = useState<FilaVencimiento[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    apiJson<FilaVencimiento[]>(mantUrl("vencimientos"), () => getToken())
      .then((data) => !cancelado && setFilas(data))
      .catch(() => {
        if (cancelado) return;
        setFilas([]);
        setError(true);
      });
    return () => {
      cancelado = true;
    };
  }, [activo, getToken]);

  const contadores = useMemo(() => {
    const c: Record<EstadoVencimiento, number> = { vencido: 0, proximo: 0, sin_datos: 0, ok: 0 };
    for (const f of filas ?? []) c[f.estado]++;
    return c;
  }, [filas]);

  const proximos = useMemo(
    () => (filas ?? []).filter((f) => f.estado === "vencido" || f.estado === "proximo").slice(0, 5),
    [filas],
  );

  return { filas, loading: filas === null, error, contadores, proximos };
}
