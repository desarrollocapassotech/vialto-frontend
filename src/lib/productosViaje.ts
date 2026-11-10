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
