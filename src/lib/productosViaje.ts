import type { Producto, Viaje } from '@/types/api';

export type ViajeProductoItem = {
  productoId: string;
  cantidad?: number | null;
  pesoKg?: number | null;
};

export type OpcionProducto = {
  id: string;
  nombre: string;
  activo: boolean;
};

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
    }));
}

/** Catálogo activo + productos ya vinculados al viaje si quedaron inactivos (para no perder selección al editar). */
export function mergeOpcionesProducto(
  activos: Producto[],
  viaje?: Viaje | null,
): OpcionProducto[] {
  const m = new Map<string, OpcionProducto>();
  for (const p of activos) {
    m.set(p.id, {
      id: p.id,
      nombre: p.nombre,
      activo: p.activo,
    });
  }
  const desdeViaje = viaje?.productosViaje?.length
    ? [...viaje.productosViaje].sort((a, b) => a.orden - b.orden)
    : [];
  for (const row of desdeViaje) {
    const cur = row.producto;
    if (cur?.id && !m.has(cur.id)) {
      m.set(cur.id, {
        id: cur.id,
        nombre: cur.activo ? cur.nombre : `${cur.nombre} (inactivo)`,
        activo: cur.activo,
      });
    }
  }
  return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}
