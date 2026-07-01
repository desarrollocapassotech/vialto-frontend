import type { Producto, StockItem } from '@/types/api';

function stockItemConSaldo(item: StockItem): boolean {
  return item.cantidad1 > 0 || item.cantidad2 > 0;
}

/** Stock del cliente/depósito con saldo disponible (> 0 en bultos o sueltas). */
export function stockItemsConSaldo(
  items: StockItem[],
  clienteId: string,
  depositoId: string,
): StockItem[] {
  return items.filter(
    (s) =>
      s.clienteId === clienteId &&
      s.depositoId === depositoId &&
      stockItemConSaldo(s),
  );
}

/**
 * Productos del catálogo limitados a los que tienen stock para el cliente/depósito.
 * Las presentaciones se reducen a las que tienen saldo en stock.
 */
export function productosConStockParaCliente(
  productos: Producto[],
  stockItems: StockItem[],
  clienteId: string,
  depositoId: string,
): Producto[] {
  const items = stockItemsConSaldo(stockItems, clienteId, depositoId);
  if (items.length === 0) return [];

  const presentacionIdsPorProducto = new Map<string, Set<string>>();
  for (const s of items) {
    let set = presentacionIdsPorProducto.get(s.productoId);
    if (!set) {
      set = new Set();
      presentacionIdsPorProducto.set(s.productoId, set);
    }
    set.add(s.presentacionId);
  }

  const productoIds = new Set(items.map((s) => s.productoId));

  return productos
    .filter((p) => productoIds.has(p.id))
    .map((p) => {
      const ppIds = presentacionIdsPorProducto.get(p.id);
      if (!ppIds) return p;
      return {
        ...p,
        productoPresentaciones: p.productoPresentaciones.filter((pp) => ppIds.has(pp.id)),
      };
    })
    .filter((p) => p.productoPresentaciones.length > 0);
}
