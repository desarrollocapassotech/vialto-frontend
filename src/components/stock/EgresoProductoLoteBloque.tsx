import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { LoteSelect } from '@/components/stock/LoteSelect';
import {
  STOCK_SIN_LOTE_VALUE,
  egresoOfreceFraccionar,
  egresoSueltasAlcanzables,
  loteEgresoSeleccionValida,
} from '@/lib/stockLote';
import { formatMovimientoStockFechaFromIso } from '@/lib/viajeFechaHora';
import {
  STOCK_FORM_INPUT as INPUT,
  STOCK_FORM_INPUT_READONLY as INPUT_READONLY,
  STOCK_FORM_LABEL as LABEL,
  STOCK_FORM_REMOVE_BTN,
} from '@/lib/stockFormLayout';

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
  unidadesPorBulto?: number;
  loteRefreshKey?: number;
  onFraccionar?: () => void;
  /** Lotes ya usados en otras líneas del mismo producto. */
  excludedLotes?: string[];
  /** Título del bloque (ej. «Lote 2»). */
  title?: string;
  /** Si hay más de una línea, permite quitar esta. */
  onRemove?: () => void;
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
  unidadesPorBulto = 0,
  loteRefreshKey,
  onFraccionar,
  excludedLotes = [],
  title = 'Extracción por lote',
  onRemove,
}: Props) {
  const listoParaLote = Boolean(productoId && presentacionId && clienteId && depositoId);
  const loteElegido = loteEgresoSeleccionValida(lote);
  const cantidadesHabilitadas = listoParaLote && loteElegido;
  const puedeFraccionar = egresoOfreceFraccionar(
    loteStock,
    sueltas,
    unidadesPorBulto,
    bultos,
  );
  const ofreceFraccionar = puedeFraccionar && Boolean(onFraccionar);
  const sueltasPedidas = parseFloat(sueltas) || 0;
  const sueltasInsuficientes =
    loteStock !== null && sueltasPedidas > loteStock.sueltas;
  const maxSueltasAlcanzables =
    loteStock && unidadesPorBulto > 0
      ? egresoSueltasAlcanzables(loteStock, unidadesPorBulto, bultos)
      : null;
  const fraccionarLabel = sueltasInsuficientes
    ? `Desarmar ${labels.bultos}`
    : 'Fraccionar';
  const sueltasFieldError = ofreceFraccionar ? undefined : fieldErrors.sueltas;
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-vialto-steel">
          {title}
        </p>
        {onRemove && (
          <button type="button" onClick={onRemove} className={`${STOCK_FORM_REMOVE_BTN} shrink-0`}>
            Quitar lote
          </button>
        )}
      </div>

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
            refreshKey={loteRefreshKey}
            excludedLotes={excludedLotes}
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
          <label className={LABEL}>{labels.bultos} a extraer</label>
          <input
            type="number"
            inputMode="decimal"
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={sueltas}
              disabled={!cantidadesHabilitadas}
              onChange={(e) => onSueltasChange(e.target.value)}
              className={`${INPUT} sm:flex-1 disabled:opacity-50 ${
                sueltasFieldError ? 'border-red-400' : ''
              }`}
              placeholder="0"
            />
            {ofreceFraccionar && (
              <button
                type="button"
                onClick={onFraccionar}
                className="h-11 shrink-0 rounded border border-vialto-fire px-2.5 text-xs font-medium uppercase tracking-wider text-vialto-fire hover:bg-vialto-fire/5 whitespace-nowrap sm:h-auto"
                title={`Desarmar ${labels.bultos} para obtener ${labels.sueltas}`}
              >
                {fraccionarLabel}
              </button>
            )}
          </div>
          {ofreceFraccionar && (
            <p className="text-xs text-vialto-steel">
              {sueltasInsuficientes
                ? maxSueltasAlcanzables !== null && sueltasPedidas > maxSueltasAlcanzables
                  ? `Pediste ${sueltasPedidas} ${labels.sueltas}; como máximo hay ${maxSueltasAlcanzables} disponibles desarmando los ${labels.bultos} restantes.`
                  : `Pediste ${sueltasPedidas} ${labels.sueltas} y hay ${loteStock!.sueltas} disponibles; desarmá ${labels.bultos} del lote sin salir del egreso.`
                : `No hay ${labels.sueltas} sueltas; podés desarmar ${labels.bultos} del lote sin salir del egreso.`}
            </p>
          )}
          <CrudFieldError message={sueltasFieldError} />
        </div>
      </div>
    </div>
  );
}
