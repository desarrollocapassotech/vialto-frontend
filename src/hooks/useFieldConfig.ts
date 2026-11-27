import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";

type FieldConfigModulo = Record<string, Record<string, boolean>>;

const globalCache: Record<string, FieldConfigModulo> = {};
const globalPromises: Record<string, Promise<FieldConfigModulo>> = {};

export function useFieldConfig(modulo: string) {
  const { getToken, isLoaded, isSignedIn, orgId } = useAuth();
  const cacheKey = `${orgId ?? ""}::${modulo}`;
  const [config, setConfig] = useState<FieldConfigModulo | null>(
    globalCache[cacheKey] ?? null
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // Asignar el estado en caché inmediatamente (evita parpadeos en la UI)
    if (globalCache[cacheKey]) {
      setConfig(globalCache[cacheKey]);
    }

    let cancelled = false;

    // Buscar los datos más recientes en segundo plano si no hay ninguna petición en curso
    if (!globalPromises[cacheKey]) {
      globalPromises[cacheKey] = apiJson<FieldConfigModulo>(
        `/api/field-config/${modulo}`,
        () => getToken(),
      ).then((data) => {
        globalCache[cacheKey] = data;
        delete globalPromises[cacheKey]; // Permite futuras recargas (refetch)
        return data;
      }).catch((err) => {
        delete globalPromises[cacheKey];
        throw err;
      });
    }

    globalPromises[cacheKey]
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        // Si hay un error y no tenemos datos en caché, asignamos null
        if (!cancelled && !globalCache[cacheKey]) setConfig(null);
      });

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, orgId, modulo, cacheKey]);

  /** true = visible (default si todavía no cargó o el campo no está en la config) */
  function isVisible(formulario: string, campo: string): boolean {
    const defaultVisible = !(campo === "valorizacion" || campo === "unidadCarga");
    if (modulo === "viajes") {
      return (
        config?.alta_viaje?.[campo] ??
        config?.edicion_viaje?.[campo] ??
        config?.detalle_viaje?.[campo] ??
        defaultVisible
      );
    }
    return config?.[formulario]?.[campo] ?? defaultVisible;
  }

  return { config, isVisible, isLoading: config === null };
}