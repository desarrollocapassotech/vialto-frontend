import type { Producto, Viaje } from '@/types/api';

export type ViajeProductoItem = {
  productoId: string;
  cantidad?: number | null;
  pesoKg?: number | null;
  pesoTn?: number | null;
  /** Texto del input de peso mientras se edita (permite escribir decimales con coma como "0,7"). */
  pesoTnStr?: string;
  presentacionId?: string | null;
  presentacion?: { id: string; nombre: string } | null;
};

const FACTOR_REDONDEO_TN = 1_000_000;

function redondearTn(n: number): number {
  return Math.round(n * FACTOR_REDONDEO_TN) / FACTOR_REDONDEO_TN;
}

/** Parsea un número decimal no negativo admitiendo coma o punto ("0,7" o "0.7"). */
export function parseDecimalViaje(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? redondearTn(n) : null;
}

/** Formatea toneladas para mostrar en inputs decimales en español ("0,7", "2"). */
export function formatPesoTnInput(pesoTn: number): string {
  return String(redondearTn(pesoTn)).replace('.', ',');
}

/** Formatea toneladas para lectura en detalle ("0,7 tn"); null si no tiene peso > 0. */
export function formatPesoTnTexto(pesoTn: number | null | undefined): string | null {
  if (pesoTn == null || !Number.isFinite(pesoTn) || pesoTn <= 0) return null;
  return `${redondearTn(pesoTn).toLocaleString('es-AR', { maximumFractionDigits: 6 })} tn`;
}

/** Suma de los pesos (> 0) de las cargas de un cliente, o null si ninguna tiene peso cargado. */
export function sumaPesosTn(
  items: readonly Pick<ViajeProductoItem, 'pesoTn'>[],
): number | null {
  let suma = 0;
  let alguno = false;
  for (const item of items) {
    if (item.pesoTn != null && Number.isFinite(item.pesoTn) && item.pesoTn > 0) {
      suma += item.pesoTn;
      alguno = true;
    }
  }
  return alguno ? redondearTn(suma) : null;
}

/**
 * Al abrir la edición de un viaje: detecta si las toneladas guardadas del cliente habían sido
 * cargadas a mano (difieren de la suma de pesos de sus cargas) para no pisarlas.
 */
export function esCantidadManualInicial(
  cantidadStr: string,
  items: readonly Pick<ViajeProductoItem, 'pesoTn'>[],
): boolean {
  const cant = parseDecimalViaje(cantidadStr);
  if (cant == null) return false;
  const suma = sumaPesosTn(items);
  if (suma == null) return true;
  return Math.abs(cant - suma) > 1e-6;
}

/**
 * Calcula el nuevo valor del campo "Toneladas" al cambiar las cargas de un cliente:
 * respeta el valor si fue editado a mano; si no, lo actualiza con la suma de pesos.
 */
export function resolverCantidadConPesos(
  actualCantidadStr: string,
  cantidadManual: boolean,
  nextItems: readonly Pick<ViajeProductoItem, 'pesoTn'>[],
  prevItems?: readonly Pick<ViajeProductoItem, 'pesoTn'>[],
): string {
  if (cantidadManual) return actualCantidadStr;
  const suma = sumaPesosTn(nextItems);
  if (suma != null) return formatPesoTnInput(suma);
  if (prevItems && sumaPesosTn(prevItems) != null) return '';
  return actualCantidadStr;
}

/** Filtra filas sin producto y limpia campos de solo UI antes de enviar a la API. */
export function productoItemsParaApi(items: readonly ViajeProductoItem[]): Array<{
  productoId: string;
  cantidad?: number;
  pesoKg?: number;
  pesoTn?: number;
  presentacionId?: string | null;
}> {
  return items
    .filter((x) => x.productoId.trim())
    .map((x) => ({
      productoId: x.productoId.trim(),
      ...(x.cantidad != null ? { cantidad: x.cantidad } : {}),
      ...(x.pesoKg != null ? { pesoKg: x.pesoKg } : {}),
      ...(x.pesoTn != null ? { pesoTn: x.pesoTn } : {}),
      presentacionId: x.presentacionId?.trim() || null,
    }));
}

export type OpcionProducto = {
  id: string;
  nombre: string;
  activo: boolean;
  /** Código del sistema (P-001…), para identificarlo en el selector. */
  codigo?: string | null;
  /** Descripción del producto, se muestra debajo del nombre en el selector. */
  descripcion?: string | null;
};

/** Opción del selector de productos a partir del producto del catálogo. */
export function opcionDesdeProducto(
  p: Pick<Producto, 'id' | 'nombre' | 'activo'> &
    Partial<Pick<Producto, 'codigo' | 'descripcion'>>,
  nombre: string = p.nombre,
): OpcionProducto {
  return {
    id: p.id,
    nombre,
    activo: p.activo,
    codigo: p.codigo ?? null,
    descripcion: p.descripcion?.trim() || null,
  };
}

type ProductoNombrado = { producto?: { nombre?: string | null } | null };

/**
 * Nombres de los productos del viaje, sin repetir: los del viaje y los de cada
 * cliente adicional (multi-cliente), en ese orden.
 */
export function nombresProductosViaje(v: {
  productosViaje?: ProductoNombrado[];
  clientesViaje?: { productosCliente?: ProductoNombrado[] }[];
}): string[] {
  const filas = [
    ...(v.productosViaje ?? []),
    ...(v.clientesViaje ?? []).flatMap((c) => c.productosCliente ?? []),
  ];
  const nombres = filas
    .map((p) => p.producto?.nombre?.trim())
    .filter((n): n is string => Boolean(n));
  return [...new Set(nombres)];
}

/** Items de producto del viaje en orden guardado. */
export function productoItemsDesdeViaje(v: Viaje): ViajeProductoItem[] {
  const rows = v.productosViaje ?? [];
  if (!rows.length) return [];
  return [...rows]
    .sort((a, b) => a.orden - b.orden)
    .map((x) => ({
      productoId: x.productoId,
      cantidad: x.cantidad,
      pesoKg: x.pesoKg,
      pesoTn: x.pesoTn ?? null,
      pesoTnStr: x.pesoTn != null ? formatPesoTnInput(x.pesoTn) : '',
      presentacionId: x.presentacionId,
      presentacion: x.presentacion,
    }));
}

/** Catálogo activo + productos ya vinculados al viaje si quedaron inactivos (para no perder selección al editar). */
export function mergeOpcionesProducto(
  activos: Producto[],
  viaje?: Viaje | null,
): OpcionProducto[] {
  const m = new Map<string, OpcionProducto>();
  for (const p of activos) {
    m.set(p.id, opcionDesdeProducto(p));
  }
  const desdeViaje = viaje?.productosViaje?.length
    ? [...viaje.productosViaje].sort((a, b) => a.orden - b.orden)
    : [];
  for (const row of desdeViaje) {
    const cur = row.producto;
    if (cur?.id && !m.has(cur.id)) {
      m.set(
        cur.id,
        opcionDesdeProducto(
          cur,
          cur.activo ? cur.nombre : `${cur.nombre} (inactivo)`,
        ),
      );
    }
  }
  return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
