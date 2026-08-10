import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";

type FieldConfigModulo = Record<string, Record<string, boolean>>;

const globalCache: Record<string, FieldConfigModulo> = {};
const globalPromises: Record<string, Promise<FieldConfigModulo>> = {};

export function useFieldConfig(modulo: string) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [config, setConfig] = useState<FieldConfigModulo | null>(
    globalCache[modulo] ?? null
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    
    // Asignar el estado en caché inmediatamente (evita parpadeos en la UI)
    if (globalCache[modulo]) {
      setConfig(globalCache[modulo]);
    }
    
    let cancelled = false;

    // Buscar los datos más recientes en segundo plano si no hay ninguna petición en curso
    if (!globalPromises[modulo]) {
      globalPromises[modulo] = apiJson<FieldConfigModulo>(
        `/api/field-config/${modulo}`,
        () => getToken(),
      ).then((data) => {
        globalCache[modulo] = data;
        delete globalPromises[modulo]; // Permite futuras recargas (refetch)
        return data;
      }).catch((err) => {
        delete globalPromises[modulo];
        throw err;
      });
    }

    globalPromises[modulo]
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        // Si hay un error y no tenemos datos en caché, asignamos null
        if (!cancelled && !globalCache[modulo]) setConfig(null);
      });

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, modulo]);

  /** true = visible (default si todavía no cargó o el campo no está en la config) */
  function isVisible(formulario: string, campo: string): boolean {
    return config?.[formulario]?.[campo] ?? true;
  }

  return { config, isVisible, isLoading: config === null };
}