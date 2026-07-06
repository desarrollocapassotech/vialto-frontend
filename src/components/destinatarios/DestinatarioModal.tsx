import { useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFieldLabel, CrudInput } from '@/components/crud/CrudFields';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyError } from '@/lib/friendlyError';
import type { Destinatario } from '@/types/api';
import { modalQuickCreateOverlayClass } from '@/lib/modalLayers';

export function DestinatarioModal({
  getToken,
  onClose,
  onSaved,
  tenantId,
  stacked,
}: {
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: (destinatario: Destinatario) => void;
  tenantId?: string;
  stacked?: boolean;
}) {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit() {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = 'Ingresá el nombre del destinatario.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);
    try {
      const path = tenantId ? `/api/platform/destinatarios${qs}` : '/api/destinatarios';
      const result = await apiJson<Destinatario>(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      onSaved(result);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Ya existe un destinatario con ese nombre.'
          : friendlyError(e, 'destinatarios'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={modalQuickCreateOverlayClass(stacked)}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="destinatario-modal-title"
        className="w-full max-w-md rounded border border-black/10 bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-3">
          <h2 id="destinatario-modal-title" className="text-lg font-semibold text-vialto-charcoal">
            Nuevo destinatario
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <form
          className="p-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="grid gap-1.5">
            <CrudFieldLabel required>Nombre</CrudFieldLabel>
            <CrudInput
              value={nombre}
              error={fieldErrors.nombre}
              placeholder="Ej: Luvi SRL, Myca SRL…"
              maxLength={200}
              autoFocus
              onChange={(e) => setNombre(e.target.value)}
            />
            <CrudFieldError message={fieldErrors.nombre} />
          </label>
          {error && (
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-black/20 rounded hover:bg-vialto-mist/60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-vialto-charcoal text-white rounded hover:bg-vialto-charcoal/90 disabled:opacity-60"
            >
              {saving && <Spinner className="h-4 w-4" />}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
