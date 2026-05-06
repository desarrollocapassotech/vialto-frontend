import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import {
  UNIDADES_MEDIDA_CARGA_OPCIONES,
} from '@/lib/unidadesMedidaCarga';
import type { Carga } from '@/types/api';

export type TipoCargaNuevoModalProps = {
  open: boolean;
  onClose: () => void;
  /** Texto sugerido (p. ej. lo buscado en el combobox). */
  nombreInicial: string;
  getToken: () => Promise<string | null>;
  onCreated: (carga: Carga) => void;
  /** Por defecto `POST /api/cargas`. Superadmin con empresa: `POST /api/platform/cargas?tenantId=…`. */
  createPostUrl?: string;
  /** Por encima del modal de viaje (`z-[110]`) o del combobox (`z-[300]`). */
  overlayClassName?: string;
};

export function TipoCargaNuevoModal({
  open,
  onClose,
  nombreInicial,
  getToken,
  onCreated,
  createPostUrl = '/api/cargas',
  overlayClassName = 'z-[400]',
}: TipoCargaNuevoModalProps) {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNombre(nombreInicial);
    setDescripcion('');
    setUnidadMedida('');
    setError(null);
  }, [open, nombreInicial]);

  const opcionesUnidad = useMemo((): Array<{ value: string; label: string }> => {
    const out: Array<{ value: string; label: string }> =
      UNIDADES_MEDIDA_CARGA_OPCIONES.map((o) => ({
        value: o.value,
        label: o.label,
      }));
    if (unidadMedida.trim() && !out.some((o) => o.value === unidadMedida)) {
      out.push({
        value: unidadMedida,
        label: `${unidadMedida} (valor previo)`,
      });
    }
    return out;
  }, [unidadMedida]);

  async function submit() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const carga = await apiJson<Carga>(createPostUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          unidadMedida: unidadMedida.trim() || undefined,
        }),
      });
      onCreated(carga);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Ya existe una carga con ese nombre (sin distinguir mayúsculas).'
          : friendlyError(e, 'cargas'),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/40 p-4 ${overlayClassName}`}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="carga-nueva-modal-titulo"
        className="w-full max-w-md rounded border border-black/10 bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="carga-nueva-modal-titulo"
          className="font-[family-name:var(--font-display)] text-xl tracking-wide"
        >
          Nueva carga
        </h2>
        <div className="mt-4 grid gap-3">
          <label className="flex flex-col gap-1 text-sm uppercase tracking-[0.08em] text-vialto-steel">
            Nombre
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="h-9 border border-black/15 px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm uppercase tracking-[0.08em] text-vialto-steel">
            Descripción (opcional)
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              className="border border-black/15 px-2 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm uppercase tracking-[0.08em] text-vialto-steel">
            Unidad de medida (opcional)
            <select
              value={unidadMedida}
              onChange={(e) => setUnidadMedida(e.target.value)}
              className="h-9 border border-black/15 bg-white px-2 text-sm"
            >
              <option value="">Sin unidad</option>
              {opcionesUnidad.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
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
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
