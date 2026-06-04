import { useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyError } from '@/lib/friendlyError';
import { choferWritePayloadFromForm, validarDniForm, type ChoferFormState } from '@/lib/choferForm';
import type { Chofer } from '@/types/api';
import { modalQuickCreateOverlayClass } from '@/lib/modalLayers';

export function ChoferModal({
  getToken,
  onClose,
  onSaved,
  tenantId,
  stacked,
}: {
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: (chofer: Chofer) => void;
  tenantId?: string;
  stacked?: boolean;
}) {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const [form, setForm] = useState<ChoferFormState>({ nombre: '', dni: '', cuit: '', telefono: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function patch(p: Partial<ChoferFormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  async function submit() {
    if (!form.nombre.trim()) { setError('Ingresá el nombre del chofer.'); return; }
    const dniError = validarDniForm(form.dni);
    if (dniError) { setError(dniError); return; }
    setSaving(true);
    setError(null);
    try {
      const path = tenantId ? `/api/platform/choferes${qs}` : '/api/choferes';
      const result = await apiJson<Chofer>(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify(choferWritePayloadFromForm(form)),
      });
      onSaved(result);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Ya existe un chofer con ese DNI.'
          : friendlyError(e, 'choferes'),
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
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">Nuevo chofer</h2>
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
            <span className={L}>Nombre *</span>
            <input
              autoFocus
              value={form.nombre}
              onChange={(e) => patch({ nombre: e.target.value })}
              placeholder="Ej: Juan Pérez"
              className={I}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={L}>DNI</span>
            <input
              value={form.dni}
              onChange={(e) => patch({ dni: e.target.value })}
              placeholder="Ej: 30123456"
              className={I}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={L}>CUIT</span>
            <input
              value={form.cuit}
              onChange={(e) => patch({ cuit: e.target.value })}
              placeholder="Ej: 20-30123456-7"
              className={I}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={L}>Teléfono</span>
            <input
              value={form.telefono}
              onChange={(e) => patch({ telefono: e.target.value })}
              placeholder="Ej: +54 9 11 1234-5678"
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
