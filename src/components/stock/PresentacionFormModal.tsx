import { useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyError } from '@/lib/friendlyError';
import type { Presentacion } from '@/types/api';

export function PresentacionFormModal({
  modo,
  presentacionInicial,
  getToken,
  onClose,
  onSaved,
  baseUrl = '/api/stock/presentaciones',
  tenantId,
}: {
  modo: 'create' | 'edit';
  presentacionInicial?: Presentacion;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: (presentacion: Presentacion) => void;
  baseUrl?: string;
  tenantId?: string;
}) {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const [nombre, setNombre] = useState(presentacionInicial?.nombre ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let result: Presentacion;
      if (modo === 'create') {
        result = await apiJson<Presentacion>(`${baseUrl}${qs}`, () => getToken(), {
          method: 'POST',
          body: JSON.stringify({ nombre: nombre.trim() }),
        });
      } else {
        result = await apiJson<Presentacion>(
          `${baseUrl}/${encodeURIComponent(presentacionInicial!.id)}${qs}`,
          () => getToken(),
          { method: 'PATCH', body: JSON.stringify({ nombre: nombre.trim() }) },
        );
      }
      onSaved(result);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Ya existe una presentación con ese nombre (sin distinguir mayúsculas).'
          : friendlyError(e, 'stock'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded border border-black/10 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-5 pt-5 pb-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            {modo === 'create' ? 'Nueva presentación' : 'Editar presentación'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4">
          <label className="flex flex-col gap-1 text-sm uppercase tracking-[0.08em] text-vialto-steel">
            Nombre <span className="text-red-500">*</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Pallets, Unidad, Cajas…"
              className="h-9 border border-black/15 px-2 text-sm normal-case tracking-normal"
              autoFocus
            />
          </label>
        </div>

        {error && (
          <p className="mx-5 mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">
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
