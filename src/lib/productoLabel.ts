import type { Tenant } from "@/types/api";

/**
 * Label personalizado de "Producto" por tenant (`Tenant.productoLabel` /
 * `productoLabelPlural`, ej. "Grano" / "Granos"), configurable desde superadmin.
 * Aplica a todo el sistema salvo el módulo Stock y el término fiscal "Líquido
 * Producto" de ARCA. Espejo de `shared/util/producto-label.util.ts` del backend.
 *
 * En componentes, leerlo con `useProductoLabels()` (`hooks/useProductoLabels.tsx`).
 * Para frases, preferir redacciones neutras ("Agregar grano", "Hay mercaderías
 * que…"): el label puede ser femenino y "Nuevo mercadería" quedaría mal.
 */
export interface ProductoLabels {
  singular: string;
  plural: string;
}

export const PRODUCTO_LABELS_DEFAULT: ProductoLabels = {
  singular: "Producto",
  plural: "Productos",
};

export function productoLabels(
  tenant: Pick<Tenant, "productoLabel" | "productoLabelPlural"> | null | undefined,
): ProductoLabels {
  const singular = tenant?.productoLabel?.trim();
  if (!singular) return PRODUCTO_LABELS_DEFAULT;
  return {
    singular,
    plural: tenant?.productoLabelPlural?.trim() || singular,
  };
}

/**
 * Label para usar en medio de una frase ("Buscar grano…"): primera letra en
 * minúscula, salvo siglas en mayúscula ("CPE" queda igual).
 */
export function labelEnFrase(label: string): string {
  const primera = label.split(/\s+/)[0] ?? "";
  if (primera.length > 1 && primera === primera.toUpperCase()) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}
