import { useEffect, useRef, useState, type Dispatch, type SetStateAction, useCallback } from 'react';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { monedaUnicaDeViajes, textoImporteFacturaSeleccion, textoMontoFacturarListado } from '@/lib/viajesFlota';
import type { Cliente, Factura, Viaje } from '@/types/api';

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'PENDIENTE',
  cobrada: 'COBRADA',
  vencida: 'VENCIDA',
};

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-950 border-amber-300/90',
  cobrada: 'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  vencida: 'bg-red-100 text-red-950 border-red-400/80',
};

export type FacturaDraft = {
  numero: string;
  tipo: 'cliente' | 'transportista_externo';
  clienteId: string;
  viajeIds: string[];
  fechaEmision: string;
  fechaVencimiento: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoToDate(iso: string | null | undefined) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function emptyFacturaDraft(): FacturaDraft {
  return {
    numero: '',
    tipo: 'cliente',
    clienteId: '',
    viajeIds: [],
    fechaEmision: todayIso(),
    fechaVencimiento: '',
  };
}

export function facturaToEditDraft(f: Factura): FacturaDraft {
  return {
    numero: f.numero,
    tipo: f.tipo,
    clienteId: f.clienteId ?? '',
    viajeIds: f.viajeIds,
    fechaEmision: isoToDate(f.fechaEmision),
    fechaVencimiento: isoToDate(f.fechaVencimiento),
  };
}

const clienteInputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';

export function ViajesCheckboxList({
  viajes,
  selected,
  onChange,
  loading,
  maxHeightClass = 'max-h-40',
}: {
  viajes: Viaje[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  /** Clases Tailwind para la caja con scroll (p. ej. max-h-56 en modal). */
  maxHeightClass?: string;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  if (loading) {
    return <p className="text-sm text-vialto-steel py-1">Cargando…</p>;
  }

  if (viajes.length === 0) {
    return <p className="text-sm text-vialto-steel py-1">No hay viajes disponibles.</p>;
  }

  return (
    <div
      className={`${maxHeightClass} overflow-y-auto divide-y divide-black/5 rounded border border-black/15 bg-white`}
    >
      {viajes.map((v) => (
        <label
          key={v.id}
          className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-vialto-mist/60"
        >
          <input
            type="checkbox"
            checked={selected.includes(v.id)}
            onChange={() => toggle(v.id)}
            className="accent-vialto-charcoal"
          />
          <span className="font-medium">{v.numero}</span>
          {(v.origen || v.destino) && (
            <span className="text-xs text-vialto-steel">
              {v.origen ?? '?'} → {v.destino ?? '?'}
            </span>
          )}
          {v.monto != null && (
            <span className="ml-auto text-xs tabular-nums text-vialto-steel">
              {textoMontoFacturarListado(v)}
            </span>
          )}
        </label>
      ))}
    </div>
  );
}

// ─── viajes vinculados editor ─────────────────────────────────────────────────

export function ViajesVinculadosEditor({
  viajes,
  disponibles,
  selected,
  onChange,
  loading,
  tipo,
  clienteId,
}: {
  viajes: Viaje[];
  disponibles: Viaje[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  tipo: FacturaDraft['tipo'];
  clienteId: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  const linkedViajes = selected
    .map((id) => viajes.find((v) => v.id === id) ?? disponibles.find((v) => v.id === id))
    .filter(Boolean) as Viaje[];

  const available = disponibles.filter((v) => !selected.includes(v.id));
  const showClienteHint = tipo === 'cliente' && !clienteId.trim();

  function remove(id: string) {
    onChange(selected.filter((x) => x !== id));
  }

  function add(id: string) {
    onChange([...selected, id]);
  }

  return (
    <div className="flex flex-col gap-2">
      {linkedViajes.length === 0 ? (
        <p className="py-1 text-sm text-vialto-steel">No hay viajes vinculados.</p>
      ) : (
        <div className="divide-y divide-black/5 rounded border border-black/15 bg-white">
          {linkedViajes.map((v) => (
            <div key={v.id} className="flex items-center gap-3 px-3 py-2">
              <span className="shrink-0 text-sm font-medium">{v.numero}</span>
              {(v.origen || v.destino) && (
                <span className="min-w-0 flex-1 truncate text-xs text-vialto-steel">
                  {v.origen ?? '?'} → {v.destino ?? '?'}
                </span>
              )}
              {v.monto != null && (
                <span className="shrink-0 text-xs tabular-nums text-vialto-steel">
                  {textoMontoFacturarListado(v)}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(v.id)}
                aria-label={`Desvincular ${v.numero}`}
                className="shrink-0 px-1 text-base leading-none text-vialto-steel hover:text-red-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div ref={pickerRef} className="relative">
        {showClienteHint ? (
          <p className="text-[11px] text-vialto-steel">
            Elegí un cliente para poder vincular viajes.
          </p>
        ) : (loading || available.length > 0) ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => setPickerOpen((o) => !o)}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
          >
            {loading ? 'Cargando…' : '+ Vincular viaje existente'}
          </button>
        ) : null}

        {pickerOpen && !showClienteHint && available.length > 0 && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[22rem] max-w-full border border-black/20 bg-white shadow-lg">
            <div className="max-h-52 overflow-y-auto divide-y divide-black/5">
              {available.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => add(v.id)}
                    className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-vialto-mist/60"
                  >
                    <span className="shrink-0 text-sm font-medium">{v.numero}</span>
                    {(v.origen || v.destino) && (
                      <span className="min-w-0 flex-1 truncate text-xs text-vialto-steel">
                        {v.origen ?? '?'} → {v.destino ?? '?'}
                      </span>
                    )}
                    {v.monto != null && (
                      <span className="shrink-0 text-xs tabular-nums text-vialto-steel">
                        {textoMontoFacturarListado(v)}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── shared hook ─────────────────────────────────────────────────────────────

function useEscapeKey(active: boolean, disabled: boolean, onClose: () => void) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disabled) {
        e.preventDefault();
        onClose();
      }
    },
    [disabled, onClose],
  );
  useEffect(() => {
    if (!active) return;
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, handler]);
}

// ─── create modal ─────────────────────────────────────────────────────────────

export type FacturaCreateModalProps = {
  open: boolean;
  draft: FacturaDraft;
  setDraft: Dispatch<SetStateAction<FacturaDraft>>;
  clientes: Cliente[];
  viajes: Viaje[];
  viajesNueva: Viaje[];
  viajesLoading: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
};

export function FacturaCreateModal({
  open,
  draft,
  setDraft,
  clientes,
  viajes,
  viajesNueva,
  viajesLoading,
  onClose,
  onSave,
  saving,
  error,
}: FacturaCreateModalProps) {
  useEscapeKey(open, saving, onClose);

  if (!open) return null;

  function patch(p: Partial<FacturaDraft>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-stretch justify-center sm:items-center sm:p-4 md:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar"
        disabled={saving}
        onClick={() => { if (!saving) onClose(); }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="factura-create-modal-title"
        className="relative flex h-full max-h-[100dvh] w-full max-w-[min(56rem,calc(100vw-1rem))] flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg sm:border sm:border-black/15"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="factura-create-modal-title"
              className="text-base font-semibold text-vialto-charcoal"
            >
              Nueva factura
            </h2>
            <p className="mt-1 text-xs text-vialto-steel">
              Completá los datos y opcionalmente vinculá viajes a esta factura.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="inline-flex h-9 shrink-0 items-center justify-center border border-black/15 bg-white px-3 text-sm text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Número *
              </label>
              <input
                type="text"
                value={draft.numero}
                onChange={(e) => patch({ numero: e.target.value })}
                placeholder="0001-00000001"
                className="h-9 border border-black/20 bg-white px-3 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Tipo *
              </label>
              <select
                value={draft.tipo}
                onChange={(e) => patch({ tipo: e.target.value as FacturaDraft['tipo'] })}
                className="h-9 border border-black/20 bg-white px-3 text-sm"
              >
                <option value="cliente">Factura a cliente</option>
                <option value="transportista_externo">Factura de transportista externo</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Cliente
              </label>
              <ClienteSearchSelect
                clientes={clientes}
                value={draft.clienteId}
                onChange={(id) => patch({ clienteId: id })}
                inputClassName={clienteInputClass}
                allowEmptyValue
                emptyListChoiceLabel="— Sin cliente —"
                placeholderCerrado="— Sin cliente —"
                aria-label="Cliente"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Fecha de emisión *
              </label>
              <input
                type="date"
                value={draft.fechaEmision}
                onChange={(e) => patch({ fechaEmision: e.target.value })}
                className="h-9 border border-black/20 bg-white px-3 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                value={draft.fechaVencimiento}
                onChange={(e) => patch({ fechaVencimiento: e.target.value })}
                className="h-9 border border-black/20 bg-white px-3 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Importe calculado
              </label>
              <p className="flex min-h-9 flex-wrap items-center gap-x-2 px-1 text-sm font-medium tabular-nums">
                {textoImporteFacturaSeleccion(draft.viajeIds, viajes)}
              </p>
              <p className="text-[10px] text-vialto-steel">
                Suma de los montos de los viajes (ARS y USD por separado).
              </p>
            </div>

            <div className="col-span-full flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Viajes vinculados {draft.viajeIds.length > 0 && `(${draft.viajeIds.length})`}
              </label>
              <ViajesVinculadosEditor
                viajes={viajes}
                disponibles={viajesNueva}
                selected={draft.viajeIds}
                onChange={(ids) => patch({ viajeIds: ids })}
                loading={viajesLoading}
                tipo={draft.tipo}
                clienteId={draft.clienteId}
              />
            </div>
          </div>

          {draft.viajeIds.length > 0 && monedaUnicaDeViajes(draft.viajeIds, viajes) === null && (
            <p className="mt-3 rounded border border-red-300/80 bg-red-50 px-3 py-2 text-xs text-red-700">
              Los viajes seleccionados tienen distintas monedas. Una factura no puede contener viajes en distintas monedas. Generá una factura por moneda.
            </p>
          )}

          {error && (
            <div className="mt-4">
              <CrudFormErrorAlert message={error} />
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-black/10 bg-vialto-mist/40 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || (draft.viajeIds.length > 0 && monedaUnicaDeViajes(draft.viajeIds, viajes) === null)}
            className="text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── edit modal ───────────────────────────────────────────────────────────────

export type FacturaEditModalProps = {
  open: boolean;
  draft: FacturaDraft;
  setDraft: Dispatch<SetStateAction<FacturaDraft | null>>;
  snapshotFactura: Factura;
  clientes: Cliente[];
  /** Listado completo de viajes (para sumar importes de los seleccionados). */
  viajes: Viaje[];
  /** Viajes mostrados en los checkboxes (filtrados por cliente/tipo/edición). */
  viajesEdicion: Viaje[];
  viajesLoading: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
};

export function FacturaEditModal({
  open,
  draft,
  setDraft,
  snapshotFactura,
  clientes,
  viajes,
  viajesEdicion,
  viajesLoading,
  onClose,
  onSave,
  saving,
  error,
}: FacturaEditModalProps) {
  useEscapeKey(open, saving, onClose);

  if (!open) return null;

  function patch(p: Partial<FacturaDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...p } : prev));
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-stretch justify-center sm:items-center sm:p-4 md:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar edición"
        disabled={saving}
        onClick={() => {
          if (!saving) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="factura-edit-modal-title"
        className="relative flex h-full max-h-[100dvh] w-full max-w-[min(56rem,calc(100vw-1rem))] flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg sm:border sm:border-black/15"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="factura-edit-modal-title"
              className="truncate text-base font-semibold text-vialto-charcoal"
            >
              Editar factura {draft.numero}
            </h2>
            <p className="mt-1 text-xs text-vialto-steel">
              Estado de cobro según los viajes vinculados. Los demás datos se guardan al confirmar.
            </p>
            <div className="mt-2">
              <span
                className={[
                  'inline-block rounded border px-2 py-0.5 text-xs font-medium',
                  ESTADO_BADGE[snapshotFactura.estado] ?? '',
                ].join(' ')}
              >
                {ESTADO_LABEL[snapshotFactura.estado] ?? snapshotFactura.estado}
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="inline-flex h-9 shrink-0 items-center justify-center border border-black/15 bg-white px-3 text-sm text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Número *
              </label>
              <input
                type="text"
                value={draft.numero}
                onChange={(e) => patch({ numero: e.target.value })}
                placeholder="0001-00000001"
                className="h-9 border border-black/20 bg-white px-3 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Tipo *
              </label>
              <select
                value={draft.tipo}
                onChange={(e) =>
                  patch({ tipo: e.target.value as FacturaDraft['tipo'] })
                }
                className="h-9 border border-black/20 bg-white px-3 text-sm"
              >
                <option value="cliente">Factura a cliente</option>
                <option value="transportista_externo">Factura de transportista externo</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Cliente
              </label>
              <ClienteSearchSelect
                clientes={clientes}
                value={draft.clienteId}
                onChange={(id) => patch({ clienteId: id })}
                inputClassName={clienteInputClass}
                allowEmptyValue
                emptyListChoiceLabel="— Sin cliente —"
                placeholderCerrado="— Sin cliente —"
                aria-label="Cliente"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Fecha de emisión *
              </label>
              <input
                type="date"
                value={draft.fechaEmision}
                onChange={(e) => patch({ fechaEmision: e.target.value })}
                className="h-9 border border-black/20 bg-white px-3 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                value={draft.fechaVencimiento}
                onChange={(e) => patch({ fechaVencimiento: e.target.value })}
                className="h-9 border border-black/20 bg-white px-3 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Importe calculado
              </label>
              <p className="flex min-h-9 flex-wrap items-center gap-x-2 px-1 text-sm font-medium tabular-nums">
                {textoImporteFacturaSeleccion(draft.viajeIds, viajes)}
              </p>
              <p className="text-[10px] text-vialto-steel">
                Suma de los montos de los viajes (ARS y USD por separado).
              </p>
            </div>

            <div className="col-span-full flex flex-col gap-1">
              <label className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Viajes vinculados {draft.viajeIds.length > 0 && `(${draft.viajeIds.length})`}
              </label>
              <ViajesVinculadosEditor
                viajes={viajes}
                disponibles={viajesEdicion}
                selected={draft.viajeIds}
                onChange={(ids) => patch({ viajeIds: ids })}
                loading={viajesLoading}
                tipo={draft.tipo}
                clienteId={draft.clienteId}
              />
            </div>
          </div>

          {draft.viajeIds.length > 0 && monedaUnicaDeViajes(draft.viajeIds, viajes) === null && (
            <p className="mt-3 rounded border border-red-300/80 bg-red-50 px-3 py-2 text-xs text-red-700">
              Los viajes seleccionados tienen distintas monedas. Una factura no puede contener viajes en distintas monedas. Generá una factura por moneda.
            </p>
          )}

          {error && (
            <div className="mt-4">
              <CrudFormErrorAlert message={error} />
            </div>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-black/10 bg-vialto-mist/40 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || (draft.viajeIds.length > 0 && monedaUnicaDeViajes(draft.viajeIds, viajes) === null)}
            className="text-xs uppercase tracking-wider px-4 py-2 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </footer>
      </div>
    </div>
  );
}
