import { useMemo, useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { UNIDADES_PRODUCTO_OPCIONES } from '@/lib/unidadesProducto';
import type { Producto } from '@/types/api';

export function ProductoModal({
  modo,
  productoInicial,
  getToken,
  onClose,
  onSaved,
  baseUrl = '/api/stock/productos',
  tenantId,
}: {
  modo: 'create' | 'edit';
  productoInicial?: Producto;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: (producto: Producto) => void;
  /** URL base sin query params. Defaults a /api/stock/productos. */
  baseUrl?: string;
  /** Para el uso superadmin: se añade como ?tenantId=xxx. */
  tenantId?: string;
}) {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const [nombre, setNombre] = useState(productoInicial?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(productoInicial?.descripcion ?? '');
  const [unidadMedida, setUnidadMedida] = useState(productoInicial?.unidadMedida ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const opcionesSelect = useMemo(() => {
    const out: { value: string; label: string }[] = UNIDADES_PRODUCTO_OPCIONES.map((o) => ({ value: o.value, label: o.label }));
    if (unidadMedida.trim() && !out.some((o) => o.value === unidadMedida)) {
      out.push({ value: unidadMedida, label: `${unidadMedida} (valor previo)` });
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
      const body = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        unidadMedida: unidadMedida.trim() || undefined,
      };
      let result: Producto;
      if (modo === 'create') {
        result = await apiJson<Producto>(`${baseUrl}${qs}`, () => getToken(), {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } else {
        result = await apiJson<Producto>(
          `${baseUrl}/${encodeURIComponent(productoInicial!.id)}${qs}`,
          () => getToken(),
          { method: 'PATCH', body: JSON.stringify(body) },
        );
      }
      onSaved(result);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Ya existe un producto con ese nombre (sin distinguir mayúsculas).'
          : friendlyError(e, 'stock'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded border border-black/10 bg-white p-5 shadow-lg"
      >
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
          {modo === 'create' ? 'Nuevo producto' : 'Editar producto'}
        </h2>
        <div className="mt-4 grid gap-3">
          <label className="flex flex-col gap-1 text-sm uppercase tracking-[0.08em] text-vialto-steel">
            Nombre *
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Rollo de papel kraft"
              className="h-9 border border-black/15 px-2 text-sm"
              autoFocus
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
              {opcionesSelect.map((o) => (
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
            className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
