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
