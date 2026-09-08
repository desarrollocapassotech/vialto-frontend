import type { MovimientoStock, Producto, StockItem } from '@/types/api';

type PresentacionLike =
  | {
      nombre?: string | null;
      presentacion?: { nombre?: string | null } | null;
    }
  | null
  | undefined;

/** Nombre de presentación (ej. Talones, Rollos) desde la relación anidada o campo directo. */
export function presentacionNombreFromLike(presentacion: PresentacionLike): string {
  return (
    presentacion?.presentacion?.nombre?.trim() ??
    presentacion?.nombre?.trim() ??
    ''
  );
}

export function presentacionNombreFromMovimiento(m: MovimientoStock): string {
  return presentacionNombreFromLike(m.presentacion);
}

export function presentacionNombreFromStockItem(
  item: StockItem,
  productos: Producto[] = [],
): string {
  const directo = presentacionNombreFromLike(item.presentacion);
  if (directo) return directo;

  const productoPresentacion = productos
    .find((p) => p.id === item.productoId)
    ?.productoPresentaciones.find(
      (pp) => pp.id === item.presentacionId || pp.presentacionId === item.presentacionId,
    );
  return productoPresentacion?.presentacion?.nombre?.trim() ?? '';
}

type PresentacionLikeConCantidad =
  | {
      nombre?: string | null;
      unidadesPorBulto?: number | null;
      presentacion?: { nombre?: string | null } | null;
    }
  | null
  | undefined;

/** Nombre + cantidad de unidades sueltas, ej: "Pallet (x12)". */
export function presentacionLabelFromLike(
  presentacion: PresentacionLikeConCantidad,
): string {
  const nombre = presentacionNombreFromLike(presentacion);
  const unidades = presentacion?.unidadesPorBulto;
  if (nombre && unidades) return `${nombre} (x${unidades})`;
  return nombre;
}

export function presentacionLabelFromMovimiento(m: MovimientoStock): string {
  return presentacionLabelFromLike(m.presentacion);
}

export function presentacionLabelFromStockItem(
  item: StockItem,
  productos: Producto[] = [],
): string {
  const directo = presentacionLabelFromLike(item.presentacion);
  if (directo) return directo;

  const productoPresentacion = productos
    .find((p) => p.id === item.productoId)
    ?.productoPresentaciones.find(
      (pp) => pp.id === item.presentacionId || pp.presentacionId === item.presentacionId,
    );
  return productoPresentacion ? presentacionLabelFromLike(productoPresentacion) : '';
}
