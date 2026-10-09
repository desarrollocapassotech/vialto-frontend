import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Crumb } from "@/lib/breadcrumbs";

type SetterCtx = {
  setOverride: (crumbs: Crumb[] | null) => void;
  /** Contenedor a la derecha del breadcrumb (ver `BreadcrumbExtras`). */
  extrasEl: HTMLElement | null;
};

const BreadcrumbSetterContext = createContext<SetterCtx | null>(null);

/**
 * Sostiene el override de breadcrumb activo y lo expone a `AppShell` vía render-prop,
 * mientras que el setter se expone a las pantallas hijas (`Outlet`) vía contexto.
 * El segundo argumento del render-prop es el ref del contenedor de extras del breadcrumb.
 */
export function BreadcrumbOverrideProvider({
  children,
}: {
  children: (
    override: Crumb[] | null,
    extrasRef: (el: HTMLElement | null) => void,
  ) => ReactNode;
}) {
  const [override, setOverride] = useState<Crumb[] | null>(null);
  const [extrasEl, setExtrasEl] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ setOverride, extrasEl }), [extrasEl]);

  return (
    <BreadcrumbSetterContext.Provider value={value}>
      {children(override, setExtrasEl)}
    </BreadcrumbSetterContext.Provider>
  );
}

/**
 * Indicadores chicos de la pantalla (ej. "Emisión vía ARCA") en la misma línea que el
 * breadcrumb, alineados a la derecha. Sin breadcrumb montado, se renderizan en el lugar.
 */
export function BreadcrumbExtras({ children }: { children: ReactNode }) {
  const ctx = useContext(BreadcrumbSetterContext);
  if (!ctx?.extrasEl) return <>{children}</>;
  return createPortal(children, ctx.extrasEl);
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
