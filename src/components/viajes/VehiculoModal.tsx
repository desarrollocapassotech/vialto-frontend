import { useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { vehiculoWritePayloadFromForm, type VehiculoFormState } from '@/lib/vehiculoForm';
import { modalQuickCreateOverlayClass } from '@/lib/modalLayers';
import type { Vehiculo } from '@/types/api';

const TIPOS = ['tractor', 'semirremolque', 'camion', 'utilitario', 'otro'] as const;

const emptyForm = (): VehiculoFormState => ({
  patente: '',
  tipo: 'camion',
  marca: '',
  modelo: '',
  anio: '',
  nroChasis: '',
  poliza: '',
  vencimientoPoliza: '',
  tara: '',
  precinto: '',
});

export function VehiculoModal({
  getToken,
  onClose,
  onSaved,
  tenantId,
  stacked,
}: {
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: (vehiculo: Vehiculo) => void;
  tenantId?: string;
  stacked?: boolean;
}) {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const [form, setForm] = useState<VehiculoFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function patch(p: Partial<VehiculoFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function submit() {
    if (!form.patente.trim()) { setError('Ingresá la patente.'); return; }
    setSaving(true);
    setError(null);
    try {
      const path = tenantId ? `/api/platform/vehiculos${qs}` : '/api/vehiculos';
      const result = await apiJson<Vehiculo>(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify(vehiculoWritePayloadFromForm(form)),
      });
      onSaved(result);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Ya existe un vehículo con esa patente.'
          : friendlyError(e, 'vehiculos'),
      );
    } finally {
      setSaving(false);
    }
  }

  const L = 'text-xs uppercase tracking-[0.08em] text-vialto-steel';
  const I = 'h-9 w-full border border-black/15 px-2 text-sm';

  return (
    <div className={modalQuickCreateOverlayClass(stacked)}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded border border-black/10 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-5 pt-5 pb-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">Nuevo vehículo</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4 grid gap-3">
          <label className="flex flex-col gap-1">
            <span className={L}>Patente *</span>
            <input
              autoFocus
              value={form.patente}
              onChange={(e) => patch({ patente: e.target.value })}
              placeholder="Ej: AA123BB"
              className={I}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={L}>Tipo</span>
            <select
              value={form.tipo}
              onChange={(e) => patch({ tipo: e.target.value })}
              className={`${I} bg-white`}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={L}>Marca</span>
            <input
              value={form.marca}
              onChange={(e) => patch({ marca: e.target.value })}
              placeholder="Ej: Scania"
              className={I}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={L}>Modelo</span>
            <input
              value={form.modelo}
              onChange={(e) => patch({ modelo: e.target.value })}
              placeholder="Ej: R450"
              className={I}
            />
          </label>
        </div>
        {error && (
          <p className="mx-5 mb-3 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
