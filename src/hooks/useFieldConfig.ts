import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiJson } from "@/lib/api";

type FieldConfigModulo = Record<string, Record<string, boolean>>;

export function useFieldConfig(modulo: string) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [config, setConfig] = useState<FieldConfigModulo | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiJson<FieldConfigModulo>(
          `/api/field-config/${modulo}`,
          () => getToken(),
        );
        if (!cancelled) setConfig(data);
      } catch {
        if (!cancelled) setConfig(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, modulo]);

  /** true = visible (default si todavía no cargó o el campo no está en la config) */
  function isVisible(formulario: string, campo: string): boolean {
    return config?.[formulario]?.[campo] ?? true;
  }

  return { config, isVisible };
}