import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Crumb } from "@/lib/breadcrumbs";

type SetterCtx = { setOverride: (crumbs: Crumb[] | null) => void };

const BreadcrumbSetterContext = createContext<SetterCtx | null>(null);

/**
 * Sostiene el override de breadcrumb activo y lo expone a `AppShell` vía render-prop,
 * mientras que el setter se expone a las pantallas hijas (`Outlet`) vía contexto.
 */
export function BreadcrumbOverrideProvider({
  children,
}: {
  children: (override: Crumb[] | null) => ReactNode;
}) {
  const [override, setOverride] = useState<Crumb[] | null>(null);
  const value = useMemo(() => ({ setOverride }), []);

  return (
    <BreadcrumbSetterContext.Provider value={value}>
      {children(override)}
    </BreadcrumbSetterContext.Provider>
  );
}

/**
 * Escape hatch para pantallas cuyo trail depende de datos que no están en la URL
 * (ej. un dato recién cargado por fetch). Pasar `null` deja el trail calculado
 * automáticamente a partir de la ruta.
 */
export function useBreadcrumbOverride(crumbs: Crumb[] | null) {
  const ctx = useContext(BreadcrumbSetterContext);
  const key = crumbs ? crumbs.map((c) => `${c.label}|${c.to ?? ""}`).join(">>") : "";

  useEffect(() => {
    if (!ctx) return;
    ctx.setOverride(crumbs);
    return () => ctx.setOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ctx]);
}
