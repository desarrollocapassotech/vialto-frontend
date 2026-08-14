import { useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyError } from '@/lib/friendlyError';
import type { Pais } from '@/types/api';
import { modalQuickCreateOverlayClass } from '@/lib/modalLayers';

export function PaisModal({
  getToken,
  onClose,
  onSaved,
  tenantId,
  stacked,
  pais,
}: {
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: (pais: Pais) => void;
  tenantId?: string;
  stacked?: boolean;
  pais?: Pais;
}) {
  const editando = !!pais;
  const [nombre, setNombre] = useState(pais?.nombre ?? '');
  const [codigo, setCodigo] = useState(pais?.codigo ?? '');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = 'Ingresá el nombre del país.';
    if (!codigo.trim()) errs.codigo = 'Ingresá el código de 2 letras (ej: BO).';
    else if (!/^[A-Z]{2}$/.test(codigo.trim())) errs.codigo = 'El código debe tener 2 letras (ej: BO).';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);
    try {
      const basePath = tenantId
        ? `/api/platform/paises?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/paises';
      const path = editando
        ? tenantId
          ? `/api/platform/paises/${encodeURIComponent(pais!.id)}?tenantId=${encodeURIComponent(tenantId)}`
          : `/api/paises/${encodeURIComponent(pais!.id)}`
        : basePath;
      const result = await apiJson<Pais>(path, () => getToken(), {
        method: editando ? 'PATCH' : 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          codigo: codigo.trim(),
        }),
      });
      onSaved(result);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 400
          ? (e.message?.includes('ya existe')
              ? 'Ya existe un país con ese nombre.'
              : e.message) || friendlyError(e, 'paises')
          : friendlyError(e, 'paises'),
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
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded border border-black/10 bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-5 pt-5 pb-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            {editando ? 'Editar país' : 'Nuevo país'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3">
            <label className="flex flex-col gap-1">
              <span className={L}>
                Nombre <span className="text-red-500">*</span>
              </span>
              <input
                autoFocus
                value={nombre}
                onChange={(e) => {
                  const v = e.target.value;
                  setNombre(v ? v.charAt(0).toUpperCase() + v.slice(1) : v);
                }}
                placeholder="Ej: Bolivia"
                className={`${I} ${fieldErrors.nombre ? 'border-red-400' : 'border-black/15'}`}
              />
              <CrudFieldError message={fieldErrors.nombre} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={L}>
                Código <span className="text-red-500">*</span>
              </span>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Ej: BO"
                maxLength={2}
                className={`${I} ${fieldErrors.codigo ? 'border-red-400' : 'border-black/15'}`}
              />
              <CrudFieldError message={fieldErrors.codigo} />
            </label>
          </div>
        </div>
        {error && (
          <p className="mx-5 mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="flex shrink-0 justify-end gap-2 border-t border-black/10 px-5 py-4">
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
