import type { StockOperacion } from '@/types/api';

export type DivisionImpacto = {
  bultosRestados: number;
  unidadesGeneradas: number;
  unidad1Nombre: string;
  unidad2Nombre: string;
  productoNombre: string | null;
};

/** Extrae el impacto neto de una operación de división (bultos → sueltas). */
export function getDivisionImpacto(op: StockOperacion): DivisionImpacto | null {
  if (op.tipo !== 'division' || op.movimientos.length === 0) return null;

  const bultosRestados = op.movimientos.reduce(
    (sum, m) => sum + (m.bultos > 0 ? m.bultos : 0),
    0,
  );
  const unidadesGeneradas = op.movimientos.reduce(
    (sum, m) => sum + (m.unidades > 0 ? m.unidades : 0),
    0,
  );

  const ref = op.movimientos.find((m) => m.bultos > 0) ?? op.movimientos[0];

  return {
    bultosRestados,
    unidadesGeneradas,
    unidad1Nombre: ref.producto?.unidad1Nombre ?? 'Pallets',
    unidad2Nombre: ref.producto?.unidad2Nombre ?? 'Unidades',
    productoNombre: ref.producto?.nombre ?? null,
  };
}

/** Lotes únicos de la operación (evita repetir el mismo lote en divisiones). */
export function stockOperacionLotesLabel(op: StockOperacion): string {
  const lotes = [
    ...new Set(
      op.movimientos
        .map((mov) => mov.lote?.trim())
        .filter((lote): lote is string => Boolean(lote)),
    ),
  ];
  return lotes.length > 0 ? lotes.join(', ') : '—';
}

/** Etiqueta de producto para la grilla: en divisiones no cuenta las dos líneas vinculadas. */
export function stockOperacionProductoLabel(op: StockOperacion): string {
  if (op.tipo === 'division') {
    const impacto = getDivisionImpacto(op);
    if (impacto?.productoNombre) return impacto.productoNombre;
  }

  const count = op.movimientos.length;
  if (count === 1) {
    return op.movimientos[0].producto?.nombre ?? '1 producto';
  }
  return `${count} productos`;
}
