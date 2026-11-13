import type { ProveedorTipo, Transportista } from "@/types/api";
import type { TransportistaLabels } from "@/lib/transportistaLabel";

/**
 * Tipos de proveedor (nov 2026). Espejo de `vialto-backend/src/shared/util/proveedor-tipo.ts`.
 *
 * Base de datos → Proveedores da de alta los tres tipos. `GET /api/transportistas` sin
 * `tipo` devuelve solo transportistas (los selectores de Viajes, Liquidaciones, Choferes
 * y Vehículos no cambian); Base de datos y Cuenta corriente piden `?tipo=todos`. Los
 * talleres se leen por `/mantenimiento/talleres`.
 */
export const PROVEEDOR_TIPOS: readonly ProveedorTipo[] = ["transportista", "taller", "otro"];

/** "Transportista" sale del label de la empresa (ej. "Fletero"). */
export function proveedorTipoLabel(tipo: ProveedorTipo, labels: TransportistaLabels): string {
  if (tipo === "transportista") return labels.singular;
  if (tipo === "taller") return "Taller";
  return "Otro";
}

export function proveedorTipoOpciones(labels: TransportistaLabels) {
  return PROVEEDOR_TIPOS.map((id) => ({ id, label: proveedorTipoLabel(id, labels) }));
}

/** Lo que se muestra como tipo de un proveedor: la categoría propia si es "otro" con nombre. */
export function etiquetaTipoProveedor(
  p: Pick<Transportista, "tipo" | "categoria">,
  labels: TransportistaLabels,
): string {
  if (p.tipo === "otro" && p.categoria?.trim()) return p.categoria.trim();
  return proveedorTipoLabel(p.tipo ?? "transportista", labels);
}

/** Tipo elegido en el selector: el tipo de fondo y, si es "otro", su nombre. */
export type TipoProveedorElegido = { tipo: ProveedorTipo; categoria: string };

/**
 * Valor del `<select>` de tipo: `transportista`, `taller`, `cat:<nombre>` (tipo propio ya
 * usado) o `nuevo` (escribir uno). Un "otro" sin nombre no tiene opción propia: muestra el
 * campo para escribirlo.
 */
export function valorSelectTipo(t: TipoProveedorElegido, categorias: string[], nuevo: boolean): string {
  if (t.tipo !== "otro") return t.tipo;
  if (nuevo) return "nuevo";
  const c = t.categoria.trim();
  return c && categorias.includes(c) ? `cat:${c}` : "nuevo";
}

/** Opciones del filtro de tipo del listado (tipos + categorías propias). */
export function opcionesFiltroTipo(labels: TransportistaLabels, categorias: string[]) {
  return [
    { id: "transportista", label: proveedorTipoLabel("transportista", labels) },
    { id: "taller", label: "Taller" },
    ...categorias.map((c) => ({ id: `cat:${c}`, label: c })),
  ];
}

/** Para qué se usa cada tipo (texto de ayuda debajo del selector de tipo). */
export const AYUDA_TIPO: Record<ProveedorTipo, string> = {
  transportista: "Se puede asignar a viajes, choferes y vehículos, y liquidarle fletes.",
  taller: "Se puede elegir en las órdenes de trabajo de Mantenimiento.",
  otro: "Cualquier otro proveedor, para llevar su cuenta corriente.",
};

/** Query de los listados que tienen que traer todos los tipos. */
export const QUERY_TODOS_LOS_PROVEEDORES = "tipo=todos";

/**
 * Opciones para un selector: solo los activos, más el que ya está elegido (aunque esté
 * desactivado) para que no quede en blanco al editar un registro viejo.
 */
export function proveedoresActivos<T extends Pick<Transportista, "id" | "activo">>(
  lista: T[],
  seleccionadoId?: string | null,
): T[] {
  return lista.filter((p) => p.activo !== false || (!!seleccionadoId && p.id === seleccionadoId));
}
