import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { LoteSelect } from '@/components/stock/LoteSelect';
import { Spinner } from '@/components/ui/Spinner';
import { STOCK_SIN_LOTE_VALUE, loteEgresoSeleccionValida } from '@/lib/stockLote';
import { formatMovimientoStockFechaFromIso, isoToFechaHora } from '@/lib/viajeFechaHora';
import type { Producto, ProductoPresentacion } from '@/types/api';

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const INPUT_READONLY =
  'h-9 w-full border border-black/10 bg-vialto-mist/30 px-2 text-sm text-vialto-charcoal';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

export type EgresoRow = {
  _key: string;
  productoId: string;
  presentacionId: string;
  lote: string;
  fechaVencimiento: string;
  loteStockBultos: number | null;
  loteStockSueltas: number | null;
  bultos: string;
  sueltas: string;
};

export function emptyEgresoRow(): EgresoRow {
  return {
    _key: crypto.randomUUID(),
    productoId: '',
    presentacionId: '',
    lote: '',
    fechaVencimiento: '',
    loteStockBultos: null,
    loteStockSueltas: null,
    bultos: '',
    sueltas: '',
  };
}

function resetLoteFields(): Pick<
  EgresoRow,
  'lote' | 'fechaVencimiento' | 'loteStockBultos' | 'loteStockSueltas' | 'bultos' | 'sueltas'
> {
  return {
    lote: '',
    fechaVencimiento: '',
    loteStockBultos: null,
    loteStockSueltas: null,
    bultos: '',
    sueltas: '',
  };
}

function getPresentaciones(productos: Producto[], productoId: string): ProductoPresentacion[] {
  return productos.find((p) => p.id === productoId)?.productoPresentaciones ?? [];
}

export function isEgresoRowComplete(row: EgresoRow): boolean {
  const b = parseFloat(row.bultos) || 0;
  const s = parseFloat(row.sueltas) || 0;
  return (
    Boolean(row.productoId) &&
    Boolean(row.presentacionId) &&
    loteEgresoSeleccionValida(row.lote) &&
    (b > 0 || s > 0)
  );
}

export function EgresoWizardStep3({
  rows,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  productos,
  productosLoading,
  fieldErrors,
  formError,
  saving,
  clienteId,
  depositoId,
  clienteNombre,
  depositoNombre,
  fechaLabel,
  lotesBase,
  tenantId,
  onVolver,
  onSubmit,
}: {
  rows: EgresoRow[];
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
  onUpdateRow: (key: string, patch: Partial<EgresoRow>) => void;
  productos: Producto[];
  productosLoading: boolean;
  fieldErrors: Record<string, string>;
  formError: string | null;
  saving: boolean;
  clienteId: string;
  depositoId: string;
  clienteNombre: string;
  depositoNombre: string;
  fechaLabel: string;
  lotesBase: string;
  tenantId?: string;
  onVolver: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="bg-vialto-mist/40 border border-black/10 rounded-lg px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-vialto-steel text-xs uppercase tracking-[0.08em] mr-1.5">Cliente</span>
          <span className="font-medium text-vialto-charcoal">{clienteNombre || '—'}</span>
        </span>
        <span>
          <span className="text-vialto-steel text-xs uppercase tracking-[0.08em] mr-1.5">Depósito</span>
          <span className="font-medium text-vialto-charcoal">{depositoNombre || '—'}</span>
        </span>
        {fechaLabel && (
          <span>
            <span className="text-vialto-steel text-xs uppercase tracking-[0.08em] mr-1.5">Fecha</span>
            <span className="font-medium text-vialto-charcoal">{fechaLabel}</span>
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-vialto-charcoal">
            Productos{' '}
            <span className="ml-1 text-sm font-normal text-vialto-steel">({rows.length})</span>
          </h2>
          <p className="text-xs text-vialto-steel mt-0.5">
            Elegí el lote antes de indicar cantidades. El vencimiento se completa solo al seleccionar
            un lote.
          </p>
        </div>

        {!productosLoading && productos.length === 0 && (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Este cliente no tiene productos con stock en el depósito seleccionado.
          </p>
        )}

        {rows.map((row, idx) => {
          const pps = getPresentaciones(productos, row.productoId);
          const selectedPP = pps.find((pp) => pp.id === row.presentacionId);
          const loteElegido = loteEgresoSeleccionValida(row.lote);
          const vencimientoLabel =
            row.lote === STOCK_SIN_LOTE_VALUE
              ? '—'
              : row.fechaVencimiento
                ? formatMovimientoStockFechaFromIso(row.fechaVencimiento)
                : loteElegido
                  ? '—'
                  : '';

          return (
            <div key={row._key} className="bg-white rounded-lg border border-black/10 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-vialto-charcoal">
                  Producto {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveRow(row._key)}
                  disabled={rows.length <= 1}
                  className="text-xs text-red-600 hover:underline disabled:opacity-30 disabled:no-underline"
                >
                  Eliminar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={LABEL}>
                    Producto <span className="text-red-500">*</span>
                  </label>
                  <SearchableEntitySelect<Producto>
                    items={productos}
                    value={row.productoId}
                    onChange={(id) =>
                      onUpdateRow(row._key, {
                        productoId: id,
                        presentacionId: '',
                        ...resetLoteFields(),
                      })
                    }
                    loading={productosLoading}
                    disabled={productos.length === 0}
                    filterItems={(items, q) => {
                      const lq = q.toLowerCase();
                      return items.filter(
                        (p) =>
                          p.nombre.toLowerCase().includes(lq) ||
                          (p.codigo?.toLowerCase().includes(lq) ?? false),
                      );
                    }}
                    getPrimaryLabel={(p) =>
                      p.codigo ? `[${p.codigo}] ${p.nombre}` : p.nombre
                    }
                    placeholderCerrado={
                      productos.length === 0 ? 'Sin productos con stock' : 'Elegí un producto…'
                    }
                    placeholderBuscar="Buscar por nombre o código…"
                    inputClassName={`${INPUT} ${
                      fieldErrors[`row_${idx}_productoId`] ? 'border-red-400' : ''
                    }`}
                  />
                  <CrudFieldError message={fieldErrors[`row_${idx}_productoId`]} />
                </div>

                <div className="space-y-1">
                  <label className={LABEL}>
                    Presentación <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={row.presentacionId}
                    onChange={(e) =>
                      onUpdateRow(row._key, {
                        presentacionId: e.target.value,
                        ...resetLoteFields(),
                      })
                    }
                    disabled={!row.productoId || pps.length === 0}
                    className={`h-9 w-full border bg-white px-2 text-sm disabled:opacity-50 ${
                      fieldErrors[`row_${idx}_presentacionId`]
                        ? 'border-red-400'
                        : 'border-black/15'
                    }`}
                  >
                    <option value="">
                      {!row.productoId
                        ? 'Primero elegí un producto'
                        : 'Elegí una presentación…'}
                    </option>
                    {pps.map((pp) => (
                      <option key={pp.id} value={pp.id}>
                        {pp.presentacion?.nombre ?? pp.presentacionId} —{' '}
                        {pp.unidadesPorBulto} uds/bulto
                      </option>
                    ))}
                  </select>
                  {selectedPP && (
                    <p className="text-xs text-vialto-steel">
                      {selectedPP.unidadesPorBulto} unidades por bulto
                    </p>
                  )}
                  <CrudFieldError message={fieldErrors[`row_${idx}_presentacionId`]} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={LABEL}>
                    Lote <span className="text-red-500">*</span>
                  </label>
                  <LoteSelect
                    productoId={row.productoId}
                    clienteId={clienteId}
                    depositoId={depositoId}
                    presentacionId={row.presentacionId}
                    value={row.lote}
                    required
                    onLoteChange={(lote, meta) =>
                      onUpdateRow(row._key, {
                        lote,
                        fechaVencimiento: meta?.fechaVencimiento
                          ? isoToFechaHora(meta.fechaVencimiento).fecha
                          : '',
                        loteStockBultos: meta?.cantidad1 ?? null,
                        loteStockSueltas: meta?.cantidad2 ?? null,
                        bultos: '',
                        sueltas: '',
                      })
                    }
                    lotesBase={lotesBase}
                    tenantId={tenantId}
                    className={INPUT}
                    disabled={!row.productoId || !row.presentacionId}
                    error={Boolean(fieldErrors[`row_${idx}_lote`])}
                  />
                  <CrudFieldError message={fieldErrors[`row_${idx}_lote`]} />
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={LABEL}>
                    Bultos <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={row.bultos}
                    onChange={(e) => onUpdateRow(row._key, { bultos: e.target.value })}
                    disabled={!loteElegido}
                    className={`${INPUT} ${
                      fieldErrors[`row_${idx}_bultos`] ? 'border-red-400' : ''
                    } disabled:opacity-50`}
                    placeholder="0"
                  />
                  {loteElegido && row.loteStockBultos !== null && (
                    <p className="text-xs text-vialto-steel">
                      Disponible en{' '}
                      {row.lote === STOCK_SIN_LOTE_VALUE ? 'sin lote' : `lote ${row.lote}`}:{' '}
                      <span className="font-semibold text-vialto-charcoal">
                        {row.loteStockBultos}
                      </span>{' '}
                      bultos
                    </p>
                  )}
                  <CrudFieldError message={fieldErrors[`row_${idx}_bultos`]} />
                </div>

                <div className="space-y-1">
                  <label className={LABEL}>Sueltas</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={row.sueltas}
                    onChange={(e) => onUpdateRow(row._key, { sueltas: e.target.value })}
                    disabled={!loteElegido}
                    className={`${INPUT} ${
                      fieldErrors[`row_${idx}_sueltas`] ? 'border-red-400' : ''
                    } disabled:opacity-50`}
                    placeholder="0"
                  />
                  {loteElegido && row.loteStockSueltas !== null && row.loteStockSueltas > 0 && (
                    <p className="text-xs text-vialto-steel">
                      Disponible:{' '}
                      <span className="font-semibold text-vialto-charcoal">
                        {row.loteStockSueltas}
                      </span>{' '}
                      sueltas
                    </p>
                  )}
                  <CrudFieldError message={fieldErrors[`row_${idx}_sueltas`]} />
                </div>
              </div>
            </div>
          );
        })}

        {(() => {
          const lastRow = rows[rows.length - 1];
          const canAdd =
            productos.length > 0 &&
            !productosLoading &&
            lastRow
              ? isEgresoRowComplete(lastRow)
              : false;
          return (
            <button
              type="button"
              onClick={onAddRow}
              disabled={!canAdd}
              title={
                !canAdd
                  ? 'Completá los campos obligatorios del producto anterior antes de agregar otro.'
                  : undefined
              }
              className={`w-full py-3 rounded text-sm font-medium transition-colors ${
                canAdd
                  ? 'bg-vialto-charcoal text-white hover:bg-vialto-charcoal/90'
                  : 'border border-dashed border-black/20 text-vialto-steel/50 cursor-not-allowed'
              }`}
            >
              + Agregar otro producto
            </button>
          );
        })()}
      </div>

      <CrudFormErrorAlert message={formError} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onVolver}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 border border-black/20 bg-white text-sm font-medium text-vialto-charcoal rounded hover:bg-vialto-mist/60 transition-colors disabled:opacity-50"
        >
          ← Volver
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-vialto-fire text-white text-sm font-semibold rounded hover:bg-vialto-fire/90 transition-colors disabled:opacity-50"
        >
          {saving && <Spinner />}
          {saving ? 'Guardando…' : 'Registrar egreso'}
        </button>
      </div>
    </form>
  );
}
