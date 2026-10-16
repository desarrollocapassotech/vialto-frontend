import { createContext, useContext, type ReactNode } from "react";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { productoLabels, type ProductoLabels } from "@/lib/productoLabel";
import type { Tenant } from "@/types/api";

const ProductoLabelsContext = createContext<ProductoLabels | null>(null);

/**
 * Fija el label de "Producto" para todo lo que se renderiza adentro. Lo montan
 * las páginas que conocen el tenant efectivo (ej. superadmin operando sobre una
 * empresa elegida); sin provider, `useProductoLabels` usa el tenant propio.
 */
export function ProductoLabelsProvider({
  tenant,
  children,
}: {
  tenant: Pick<Tenant, "productoLabel" | "productoLabelPlural"> | null | undefined;
  children: ReactNode;
}) {
  return (
    <ProductoLabelsContext.Provider value={productoLabels(tenant)}>
      {children}
    </ProductoLabelsContext.Provider>
  );
}

/**
 * Label de "Producto" ("Grano"/"Granos") del tenant. No usar en el módulo Stock
 * (ahí siempre es "Producto"): los componentes compartidos con Stock reciben el
 * label por prop (ej. `ProductoModal`).
 */
export function useProductoLabels(): ProductoLabels {
  const desdeProvider = useContext(ProductoLabelsContext);
  const { tenant } = useCurrentTenant();
  return desdeProvider ?? productoLabels(tenant);
}
