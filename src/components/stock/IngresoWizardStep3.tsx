import { useState } from 'react';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { LoteDatalistInput } from '@/components/stock/LoteDatalistInput';
import { ProductoModal } from '@/components/stock/ProductoModal';
import { Spinner } from '@/components/ui/Spinner';
import type { Producto, ProductoPresentacion } from '@/types/api';

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

export type IngresoRow = {
  _key: string;
  productoId: string;
  presentacionId: string;
  bultos: string;
  sueltas: string;
  lote: string;
  fechaVencimiento: string;
};

export function emptyRow(): IngresoRow {
  return {
    _key: crypto.randomUUID(),
    productoId: '',
    presentacionId: '',
    bultos: '',
    sueltas: '',
    lote: '',
    fechaVencimiento: '',
  };
}

function getPresentaciones(productos: Producto[], productoId: string): ProductoPresentacion[] {
  return productos.find((p) => p.id === productoId)?.productoPresentaciones ?? [];
}

function isRowComplete(row: IngresoRow): boolean {
  const b = parseFloat(row.bultos) || 0;
  const s = parseFloat(row.sueltas) || 0;
  return (
    Boolean(row.productoId) &&
    Boolean(row.presentacionId) &&
    row.lote.trim().length > 0 &&
    Boolean(row.fechaVencimiento) &&
    (b > 0 || s > 0)
  );
}

export function IngresoWizardStep3({
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
  getToken,
  productosBase,
  canCreateProducto,
  onProductoCreado,
  onVolver,
  onSubmit,
}: {
  rows: IngresoRow[];
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
  onUpdateRow: (key: string, patch: Partial<IngresoRow>) => void;
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
  getToken: () => Promise<string | null>;
  productosBase: string;
  canCreateProducto?: boolean;
  onProductoCreado: (p: Producto) => void;
  onVolver: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const [nuevoProductoRowKey, setNuevoProductoRowKey] = useState<string | null>(null);

  return (
    <>
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Resumen pasos 1 y 2 */}
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

      {/* Listado de productos */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-vialto-charcoal">
            Productos{' '}
            <span className="ml-1 text-sm font-normal text-vialto-steel">({rows.length})</span>
          </h2>
          <p className="text-xs text-vialto-steel mt-0.5">
            Completá los datos de cada producto. Podés agregar más al terminar cada uno.
          </p>
        </div>

        {rows.map((row, idx) => {
          const pps = getPresentaciones(productos, row.productoId);
          const selectedPP = pps.find((pp) => pp.id === row.presentacionId);

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

              {/* Producto y presentación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={LABEL}>
                    Producto <span className="text-red-500">*</span>
                  </label>
                  <SearchableEntitySelect<Producto>
                    items={productos}
                    value={row.productoId}
                    onChange={(id) =>
                      onUpdateRow(row._key, { productoId: id, presentacionId: '' })
                    }
                    loading={productosLoading}
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
                    placeholderCerrado="Elegí un producto…"
                    placeholderBuscar="Buscar por nombre o código…"
                    inputClassName={`${INPUT} ${
                      fieldErrors[`row_${idx}_productoId`] ? 'border-red-400' : ''
                    }`}
                    onNuevo={canCreateProducto ? () => setNuevoProductoRowKey(row._key) : undefined}
                    onNuevoLabel="+ Nuevo producto"
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
                      onUpdateRow(row._key, { presentacionId: e.target.value })
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

              {/* Cantidades */}
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
                    className={`${INPUT} ${
                      fieldErrors[`row_${idx}_bultos`] ? 'border-red-400' : ''
                    }`}
                    placeholder="0"
                  />
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
                    className={INPUT}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Lote y vencimiento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={LABEL}>
                    Lote <span className="text-red-500">*</span>
                  </label>
                  <LoteDatalistInput
                    productoId={row.productoId}
                    clienteId={clienteId}
                    depositoId={depositoId}
                    lotesBase={lotesBase}
                    tenantId={tenantId}
                    value={row.lote}
                    onChange={(v) => onUpdateRow(row._key, { lote: v })}
                    className={INPUT}
                    error={Boolean(fieldErrors[`row_${idx}_lote`])}
                  />
                  <CrudFieldError message={fieldErrors[`row_${idx}_lote`]} />
                </div>

                <div className="space-y-1">
                  <label className={LABEL}>
                    Vencimiento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={row.fechaVencimiento}
                    onChange={(e) =>
                      onUpdateRow(row._key, { fechaVencimiento: e.target.value })
                    }
                    className={`${INPUT} ${
                      fieldErrors[`row_${idx}_fechaVencimiento`] ? 'border-red-400' : ''
                    }`}
                  />
                  <CrudFieldError message={fieldErrors[`row_${idx}_fechaVencimiento`]} />
                </div>
              </div>
            </div>
          );
        })}

        {(() => {
          const lastRow = rows[rows.length - 1];
          const canAdd = lastRow ? isRowComplete(lastRow) : false;
          return (
            <button
              type="button"
              onClick={onAddRow}
              disabled={!canAdd}
              title={!canAdd ? 'Completá los campos obligatorios del producto anterior antes de agregar otro.' : undefined}
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
          {saving ? 'Guardando…' : 'Guardar ingreso'}
        </button>
      </div>
    </form>

    {nuevoProductoRowKey !== null && (
      <ProductoModal
        modo="create"
        getToken={getToken}
        baseUrl={productosBase}
        tenantId={tenantId}
        onClose={() => setNuevoProductoRowKey(null)}
        onSaved={(p) => {
          onProductoCreado(p);
          onUpdateRow(nuevoProductoRowKey, { productoId: p.id, presentacionId: '' });
          setNuevoProductoRowKey(null);
        }}
      />
    )}
    </>
  );
}
