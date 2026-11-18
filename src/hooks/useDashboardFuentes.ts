import { useAuth } from "@clerk/clerk-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiJson } from "@/lib/api";
import { fetchTablero, type TableroCcResponse } from "@/lib/cuentaCorriente";
import type { CombustibleDashboardResponse } from "@/types/combustibleDashboard";
import type { FinancieroDashboardResponse } from "@/types/financieroDashboard";

type Rango = { from: string; to: string } | null;

/**
 * Pide una fuente del dashboard solo si `activo` y hay rango. Evita dos pedidos en
 * vuelo a la vez (el polling no pisa una respuesta con otra vieja). Errores
 * silenciosos: el bloque muestra "—" y se reintenta al cambiar el período.
 */
function useFuente<T>(
  activo: boolean,
  rango: Rango,
  cargar: (rango: { from: string; to: string }, getToken: () => Promise<string | null>) => Promise<T>,
  pollMs?: number,
) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  const cargarRef = useRef(cargar);
  useEffect(() => {
    getTokenRef.current = getToken;
    cargarRef.current = cargar;
  });
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const enVuelo = useRef(false);
  const from = rango?.from;
  const to = rango?.to;

  /** `silencioso`: refresco automático, sin marcar `loading` (no muestra el loader del período). */
  const refrescar = useCallback(async (silencioso = false) => {
    if (!activo || !isLoaded || !isSignedIn || !from || !to || enVuelo.current) return;
    enVuelo.current = true;
    if (!silencioso) setLoading(true);
    try {
      setData(await cargarRef.current({ from, to }, () => getTokenRef.current()));
      setError(false);
    } catch {
      // Silencioso (ej. 403 de /dashboard/financiero para un member): el bloque deja de "cargar".
      setError(true);
    } finally {
      setLoading(false);
      enVuelo.current = false;
    }
  }, [activo, isLoaded, isSignedIn, from, to]);

  useEffect(() => {
    void refrescar();
  }, [refrescar]);

  useEffect(() => {
    if (!activo || !pollMs) return;
    const t = setInterval(() => void refrescar(true), pollMs);
    return () => clearInterval(t);
  }, [activo, pollMs, refrescar]);

  /** Todavía no hay nada que mostrar (ni datos ni un error). */
  const esperando = activo && data === null && !error;
  return { data, loading, error, esperando };
}

export function useFinancieroDashboard(activo: boolean, rango: Rango) {
  return useFuente<FinancieroDashboardResponse>(activo, rango, (r, getToken) =>
    apiJson(`/api/dashboard/financiero?${new URLSearchParams(r).toString()}`, getToken),
  );
}

/** `conPolling`: las alertas de combustible se refrescan solas cada 30 s mientras se ven. */
export function useCombustibleDashboard(activo: boolean, rango: Rango, conPolling: boolean) {
  return useFuente<CombustibleDashboardResponse>(
    activo,
    rango,
    (r, getToken) =>
      apiJson(`/api/combustible/dashboard?${new URLSearchParams(r).toString()}`, getToken),
    conPolling ? 30000 : undefined,
  );
}

export function useTableroCuentaCorriente(activo: boolean, rango: Rango) {
  return useFuente<TableroCcResponse>(activo, rango, (r, getToken) =>
    fetchTablero(getToken, { desde: r.from, hasta: r.to }),
  );
}
