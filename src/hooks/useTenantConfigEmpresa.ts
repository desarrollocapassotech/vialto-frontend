import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import type { Tenant } from "@/types/api";

type GuardarOpciones = {
  /** Mensaje del toast de éxito. Default "Cambios guardados". */
  mensaje?: string;
  /**
   * Campos que hay que tomar de la respuesta además de los enviados (los que
   * calcula el backend: plural generado por IA, cascada de ID Propio 2…).
   */
  desdeRespuesta?: (keyof Tenant)[];
};

/**
 * Tenant elegido en "Configuración por empresa" (superadmin) + guardado inmediato
 * de cualquier campo con `PATCH /api/tenants/:orgId`. Actualiza la pantalla en el
 * momento y vuelve atrás si la API falla.
 */
export function useTenantConfigEmpresa(orgId: string | null) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { showToast } = useToast();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<ReadonlySet<string>>(new Set());
  const tenantRef = useRef<Tenant | null>(null);
  tenantRef.current = tenant;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !orgId) {
      setTenant(null);
      return;
    }
    let cancelled = false;
    // Nunca mostrar (ni guardar sobre) los datos de la empresa anterior.
    setTenant(null);
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const t = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(orgId)}`,
          () => getToken(),
        );
        if (!cancelled) setTenant(t);
      } catch (e) {
        if (!cancelled) {
          setTenant(null);
          setError(friendlyError(e, "camposEmpresa"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, orgId]);

  /** Cambia la copia local sin guardar (ej. lo guardó otro componente). */
  const actualizarLocal = useCallback((patch: Partial<Tenant>) => {
    setTenant((t) => (t ? { ...t, ...patch } : t));
  }, []);

  const guardar = useCallback(
    async (patch: Partial<Tenant>, opciones?: GuardarOpciones): Promise<boolean> => {
      const actual = tenantRef.current;
      if (!orgId || !actual) return false;
      const claves = Object.keys(patch) as (keyof Tenant)[];
      const previos = Object.fromEntries(claves.map((k) => [k, actual[k]])) as Partial<Tenant>;
      setTenant((t) => (t ? { ...t, ...patch } : t));
      setGuardando((s) => new Set([...s, ...claves]));
      try {
        const resp = await apiJson<Tenant>(
          `/api/tenants/${encodeURIComponent(orgId)}`,
          () => getToken(),
          { method: "PATCH", body: JSON.stringify(patch) },
        );
        const extra = opciones?.desdeRespuesta ?? [];
        if (resp && extra.length > 0) {
          const deResp = Object.fromEntries(extra.map((k) => [k, resp[k]])) as Partial<Tenant>;
          setTenant((t) => (t ? { ...t, ...deResp } : t));
        }
        showToast(opciones?.mensaje ?? "Cambios guardados", "success");
        return true;
      } catch (e) {
        setTenant((t) => (t ? { ...t, ...previos } : t));
        showToast(friendlyError(e, "camposEmpresa"), "error");
        return false;
      } finally {
        setGuardando((s) => {
          const next = new Set(s);
          claves.forEach((k) => next.delete(k));
          return next;
        });
      }
    },
    [orgId, getToken, showToast],
  );

  const estaGuardando = useCallback(
    (...claves: (keyof Tenant)[]) => claves.some((k) => guardando.has(k)),
    [guardando],
  );

  return { tenant, loading, error, guardar, actualizarLocal, estaGuardando };
}

export type TenantConfigEmpresa = ReturnType<typeof useTenantConfigEmpresa>;
