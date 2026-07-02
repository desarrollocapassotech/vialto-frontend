import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { LoteSelect } from '@/components/stock/LoteSelect';
import {
  STOCK_SIN_LOTE_VALUE,
  loteEgresoSeleccionValida,
} from '@/lib/stockLote';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const INPUT_READONLY =
  'h-9 w-full border border-black/10 bg-vialto-mist/30 px-2 text-sm text-vialto-charcoal';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

export type LoteStockDisponible = {
  bultos: number;
  sueltas: number;
};

type Props = {
  productoId: string;
  presentacionId: string;
  clienteId: string;
  depositoId: string;
  lote: string;
  fechaVencimiento: string;
  bultos: string;
  sueltas: string;
  loteStock: LoteStockDisponible | null;
  onLoteChange: (
    lote: string,
    stock: LoteStockDisponible | null,
    fechaVencimiento: string,
  ) => void;
  onBultosChange: (value: string) => void;
  onSueltasChange: (value: string) => void;
  fieldErrors: {
    lote?: string;
    bultos?: string;
    sueltas?: string;
  };
  lotesBase: string;
  tenantId?: string;
  labels?: { bultos: string; sueltas: string };
};

function etiquetaDisponibleLote(
  lote: string,
  stock: LoteStockDisponible,
  labels: { bultos: string; sueltas: string },
): string {
  const origen = lote === STOCK_SIN_LOTE_VALUE ? 'sin lote' : `lote ${lote}`;
  const partes: string[] = [];
  partes.push(`${stock.bultos} ${labels.bultos}`);
  partes.push(`${stock.sueltas} ${labels.sueltas}`);
  return `Disponible en ${origen}: ${partes.join(' y ')}`;
}

/** Bloque modular: Lote → stock del lote → cantidades a extraer (preparado para multi-lote). */
export function EgresoProductoLoteBloque({
  productoId,
  presentacionId,
  clienteId,
  depositoId,
  lote,
  fechaVencimiento,
  bultos,
  sueltas,
  loteStock,
  onLoteChange,
  onBultosChange,
  onSueltasChange,
  fieldErrors,
  lotesBase,
  tenantId,
  labels = { bultos: 'bultos', sueltas: 'sueltas' },
}: Props) {
  const listoParaLote = Boolean(productoId && presentacionId && clienteId && depositoId);
  const loteElegido = loteEgresoSeleccionValida(lote);
  const cantidadesHabilitadas = listoParaLote && loteElegido;
  const vencimientoLabel =
    lote === STOCK_SIN_LOTE_VALUE
      ? '—'
      : fechaVencimiento
        ? formatMovimientoStockFechaFromIso(fechaVencimiento)
        : loteElegido
          ? '—'
          : '';

  return (
    <div className="space-y-3 rounded border border-black/10 bg-vialto-mist/20 p-3">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-vialto-steel">
        Extracción por lote
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={LABEL}>
            Lote de origen <span className="text-red-500">*</span>
          </label>
          <LoteSelect
            productoId={productoId}
            clienteId={clienteId}
            depositoId={depositoId}
            presentacionId={presentacionId}
            value={lote}
            onLoteChange={(selectedLote, stock) =>
              onLoteChange(
                selectedLote,
                stock ? { bultos: stock.bultos, sueltas: stock.sueltas } : null,
                stock?.fechaVencimiento ?? '',
              )
            }
            lotesBase={lotesBase}
            tenantId={tenantId}
            className={`${INPUT} ${fieldErrors.lote ? 'border-red-400' : ''}`}
            disabled={!listoParaLote}
            required
            error={Boolean(fieldErrors.lote)}
            placeholder={
              !productoId
                ? 'Primero elegí un producto'
                : !presentacionId
                  ? 'Primero elegí una presentación'
                  : 'Elegí un lote con stock…'
            }
          />
          <CrudFieldError message={fieldErrors.lote} />
        </div>

        <div className="space-y-1">
          <label className={LABEL}>Vencimiento</label>
          <input
            type="text"
            readOnly
            tabIndex={-1}
            value={vencimientoLabel}
            placeholder={loteElegido ? '—' : 'Elegí un lote primero'}
            className={INPUT_READONLY}
          />
        </div>
      </div>

      {loteElegido && loteStock !== null && (
        <p className="text-sm text-vialto-charcoal">
          {etiquetaDisponibleLote(lote, loteStock, labels)}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={LABEL}>
            {labels.bultos} a extraer <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="any"
            value={bultos}
            disabled={!cantidadesHabilitadas}
            onChange={(e) => onBultosChange(e.target.value)}
            className={`${INPUT} disabled:opacity-50 ${
              fieldErrors.bultos ? 'border-red-400' : ''
            }`}
            placeholder="0"
          />
          <CrudFieldError message={fieldErrors.bultos} />
        </div>

        <div className="space-y-1">
          <label className={LABEL}>{labels.sueltas} a extraer</label>
          <input
            type="number"
            min="0"
            step="any"
            value={sueltas}
            disabled={!cantidadesHabilitadas}
            onChange={(e) => onSueltasChange(e.target.value)}
            className={`${INPUT} disabled:opacity-50 ${
              fieldErrors.sueltas ? 'border-red-400' : ''
            }`}
            placeholder="0"
          />
          <CrudFieldError message={fieldErrors.sueltas} />
        </div>
      </div>
    </div>
  );
}
