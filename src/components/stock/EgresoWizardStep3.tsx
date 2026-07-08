import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import {
  EgresoProductoLoteBloque,
  type LoteStockDisponible,
} from '@/components/stock/EgresoProductoLoteBloque';
import { Spinner } from '@/components/ui/Spinner';
import { loteEgresoParaApi, loteEgresoSeleccionValida } from '@/lib/stockLote';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';
import type { Producto, ProductoPresentacion } from '@/types/api';

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

export type EgresoLoteLinea = {
  _key: string;
  lote: string;
  fechaVencimiento: string;
  bultos: string;
  sueltas: string;
  loteStock: LoteStockDisponible | null;
};

export type EgresoRow = {
  _key: string;
  productoId: string;
  presentacionId: string;
  loteLineas: EgresoLoteLinea[];
};

export function emptyEgresoLoteLinea(): EgresoLoteLinea {
  return {
    _key: crypto.randomUUID(),
    lote: '',
    fechaVencimiento: '',
    bultos: '',
    sueltas: '',
    loteStock: null,
  };
}

export function emptyEgresoRow(): EgresoRow {
  return {
    _key: crypto.randomUUID(),
    productoId: '',
    presentacionId: '',
    loteLineas: [emptyEgresoLoteLinea()],
  };
}

function resetLoteLineas(): EgresoLoteLinea[] {
  return [emptyEgresoLoteLinea()];
}

function getPresentaciones(productos: Producto[], productoId: string): ProductoPresentacion[] {
  return productos.find((p) => p.id === productoId)?.productoPresentaciones ?? [];
}

export function isEgresoLoteLineaComplete(linea: EgresoLoteLinea): boolean {
  const b = parseFloat(linea.bultos) || 0;
  const s = parseFloat(linea.sueltas) || 0;
  return loteEgresoSeleccionValida(linea.lote) && (b > 0 || s > 0);
}

export function isEgresoRowComplete(row: EgresoRow): boolean {
  return (
    Boolean(row.productoId) &&
    Boolean(row.presentacionId) &&
    row.loteLineas.length > 0 &&
    row.loteLineas.every(isEgresoLoteLineaComplete)
  );
}

export function egresoFieldKey(rowIdx: number, loteIdx: number, field: 'lote' | 'bultos' | 'sueltas') {
  return `row_${rowIdx}_lote_${loteIdx}_${field}`;
}

export type EgresoApiLinea = {
  productoId: string;
  presentacionId: string;
  bultos: number;
  sueltas: number;
  lote: string | null;
  fechaVencimiento?: string;
};

export function egresoRowsToApiLineas(rows: EgresoRow[]): EgresoApiLinea[] {
  return rows.flatMap((row) =>
    row.loteLineas.map((linea) => ({
      productoId: row.productoId,
      presentacionId: row.presentacionId,
      bultos: parseFloat(linea.bultos) || 0,
      sueltas: parseFloat(linea.sueltas) || 0,
      lote: loteEgresoParaApi(linea.lote),
      ...(linea.fechaVencimiento
        ? { fechaVencimiento: fechaHoraToIso(linea.fechaVencimiento, '00:00') ?? undefined }
        : {}),
    })),
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
  primaryAction = 'registrar',
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
  saving?: boolean;
  clienteId: string;
  depositoId: string;
  clienteNombre: string;
  depositoNombre: string;
  fechaLabel?: string;
  lotesBase: string;
  tenantId?: string;
  primaryAction?: 'continuar' | 'registrar';
  onVolver: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  function updateLoteLinea(
    rowKey: string,
    loteKey: string,
    patch: Partial<EgresoLoteLinea>,
  ) {
    const row = rows.find((r) => r._key === rowKey);
    if (!row) return;
    onUpdateRow(rowKey, {
      loteLineas: row.loteLineas.map((ll) =>
        ll._key === loteKey ? { ...ll, ...patch } : ll,
      ),
    });
  }

  function addLoteLinea(rowKey: string) {
    const row = rows.find((r) => r._key === rowKey);
    if (!row) return;
    const last = row.loteLineas[row.loteLineas.length - 1];
    if (!last || !isEgresoLoteLineaComplete(last)) return;
    onUpdateRow(rowKey, {
      loteLineas: [...row.loteLineas, emptyEgresoLoteLinea()],
    });
  }

  function removeLoteLinea(rowKey: string, loteKey: string) {
    const row = rows.find((r) => r._key === rowKey);
    if (!row || row.loteLineas.length <= 1) return;
    onUpdateRow(rowKey, {
      loteLineas: row.loteLineas.filter((ll) => ll._key !== loteKey),
    });
  }

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
            Solo se listan productos con stock en el cliente y depósito elegidos. Elegí producto y
            presentación; luego uno o más lotes de origen con las cantidades a extraer de cada uno.
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
          const lastLoteLinea = row.loteLineas[row.loteLineas.length - 1];
          const canAddLote =
            Boolean(row.productoId && row.presentacionId) &&
            lastLoteLinea &&
            isEgresoLoteLineaComplete(lastLoteLinea);

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
                        loteLineas: resetLoteLineas(),
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
                      productos.length === 0
                        ? 'Sin productos con stock'
                        : 'Elegí un producto…'
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
                        loteLineas: resetLoteLineas(),
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

              <div className="space-y-3">
                {row.loteLineas.map((linea, loteIdx) => {
                  const excludedLotes = row.loteLineas
                    .filter((ll) => ll._key !== linea._key && loteEgresoSeleccionValida(ll.lote))
                    .map((ll) => ll.lote);

                  return (
                    <EgresoProductoLoteBloque
                      key={linea._key}
                      productoId={row.productoId}
                      presentacionId={row.presentacionId}
                      clienteId={clienteId}
                      depositoId={depositoId}
                      lote={linea.lote}
                      fechaVencimiento={linea.fechaVencimiento}
                      bultos={linea.bultos}
                      sueltas={linea.sueltas}
                      loteStock={linea.loteStock}
                      onLoteChange={(lote, stock, fechaVencimiento) =>
                        updateLoteLinea(row._key, linea._key, {
                          lote,
                          loteStock: stock,
                          fechaVencimiento: fechaVencimiento
                            ? isoToFechaHora(fechaVencimiento).fecha
                            : '',
                          bultos: '',
                          sueltas: '',
                        })
                      }
                      onBultosChange={(bultos) =>
                        updateLoteLinea(row._key, linea._key, { bultos })
                      }
                      onSueltasChange={(sueltas) =>
                        updateLoteLinea(row._key, linea._key, { sueltas })
                      }
                      fieldErrors={{
                        lote: fieldErrors[egresoFieldKey(idx, loteIdx, 'lote')],
                        bultos: fieldErrors[egresoFieldKey(idx, loteIdx, 'bultos')],
                        sueltas: fieldErrors[egresoFieldKey(idx, loteIdx, 'sueltas')],
                      }}
                      lotesBase={lotesBase}
                      tenantId={tenantId}
                      excludedLotes={excludedLotes}
                      title={
                        row.loteLineas.length > 1
                          ? `Lote ${loteIdx + 1}`
                          : 'Extracción por lote'
                      }
                      onRemove={
                        row.loteLineas.length > 1
                          ? () => removeLoteLinea(row._key, linea._key)
                          : undefined
                      }
                    />
                  );
                })}

                <button
                  type="button"
                  onClick={() => addLoteLinea(row._key)}
                  disabled={!canAddLote}
                  title={
                    !canAddLote
                      ? 'Completá el lote y las cantidades antes de agregar otro.'
                      : undefined
                  }
                  className={`w-full py-2 rounded text-sm font-medium transition-colors border ${
                    canAddLote
                      ? 'border-black/20 text-vialto-charcoal hover:bg-vialto-mist/60'
                      : 'border-dashed border-black/15 text-vialto-steel/50 cursor-not-allowed'
                  }`}
                >
                  + Añadir otro lote
                </button>
              </div>
            </div>
          );
        })}

        {(() => {
          const lastRow = rows[rows.length - 1];
          const canAdd =
            productos.length > 0 && !productosLoading && lastRow
              ? isEgresoRowComplete(lastRow)
              : false;
          return (
            <button
              type="button"
              onClick={onAddRow}
              disabled={!canAdd}
              title={
                !canAdd
                  ? 'Completá producto, lotes y cantidades antes de agregar otro.'
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
          disabled={primaryAction === 'registrar' && saving}
          className="inline-flex items-center gap-2 px-4 py-2 border border-black/20 bg-white text-sm font-medium text-vialto-charcoal rounded hover:bg-vialto-mist/60 transition-colors disabled:opacity-50"
        >
          ← Volver
        </button>
        <button
          type="submit"
          disabled={primaryAction === 'registrar' && saving}
          className={`inline-flex items-center gap-2 px-6 py-2.5 text-white text-sm font-semibold rounded transition-colors disabled:opacity-50 ${
            primaryAction === 'continuar'
              ? 'bg-vialto-charcoal hover:bg-vialto-charcoal/90'
              : 'bg-vialto-fire hover:bg-vialto-fire/90'
          }`}
        >
          {primaryAction === 'registrar' && saving && <Spinner />}
          {primaryAction === 'continuar'
            ? 'Continuar →'
            : saving
              ? 'Guardando…'
              : 'Registrar egreso'}
        </button>
      </div>
    </form>
  );
}
