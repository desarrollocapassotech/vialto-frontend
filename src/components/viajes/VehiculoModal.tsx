import { useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { friendlyError } from '@/lib/friendlyError';
import { Spinner } from '@/components/ui/Spinner';
import { vehiculoCreatePayloadFromForm, type VehiculoFormState } from '@/lib/vehiculoForm';
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function patch(p: Partial<VehiculoFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function submit() {
    if (!form.patente.trim()) {
      setFieldErrors({ patente: 'Ingresá la patente.' });
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);
    try {
      const path = tenantId ? `/api/platform/vehiculos${qs}` : '/api/vehiculos';
      const result = await apiJson<Vehiculo>(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify(vehiculoCreatePayloadFromForm(form)),
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
  const I = 'h-9 w-full border px-2 text-sm';

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
            <span className={L}>Patente <span className="text-red-500">*</span></span>
            <input
              autoFocus
              value={form.patente}
              onChange={(e) => patch({ patente: e.target.value })}
              placeholder="Ej: AA123BB"
              className={`${I} ${fieldErrors.patente ? 'border-red-400' : 'border-black/15'}`}
            />
            <CrudFieldError message={fieldErrors.patente} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={L}>Tipo</span>
            <select
              value={form.tipo}
              onChange={(e) => patch({ tipo: e.target.value })}
              className={`${I} border-black/15 bg-white`}
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
              className={`${I} border-black/15`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={L}>Modelo</span>
            <input
              value={form.modelo}
              onChange={(e) => patch({ modelo: e.target.value })}
              placeholder="Ej: R450"
              className={`${I} border-black/15`}
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
            className="inline-flex items-center gap-2 h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
          >
            {saving && <Spinner className="h-3.5 w-3.5" />}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
