import { movimientoStockTipoNumeroClass } from '@/lib/stockMovimientoTipo';
import type { MovimientoStock } from '@/types/api';

/** Cantidad + unidad/presentación en una sola línea horizontal (grilla de movimientos). */
export function MovimientoCantidadLinea({
  cantidad,
  etiqueta,
  tipo,
}: {
  cantidad: number;
  etiqueta?: string | null;
  tipo: MovimientoStock['tipo'];
}) {
  return (
    <div className="flex justify-end">
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className={movimientoStockTipoNumeroClass(tipo)}>{cantidad}</span>
        {etiqueta ? (
          <span className="text-xs font-normal text-vialto-steel">{etiqueta}</span>
        ) : null}
      </span>
    </div>
  );
}
