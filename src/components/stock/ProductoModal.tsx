import { useMemo, useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyError } from '@/lib/friendlyError';
import { UNIDADES_PRODUCTO_OPCIONES } from '@/lib/unidadesProducto';
import type { Producto } from '@/types/api';

export function ProductoModal({
  modo,
  productoInicial,
  getToken,
  onClose,
  onSaved,
  onEdit,
  baseUrl = '/api/stock/productos',
  tenantId,
}: {
  modo: 'create' | 'edit' | 'view';
  productoInicial?: Producto;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: (producto: Producto) => void;
  /** Llamado cuando el usuario presiona "Editar" en modo view. */
  onEdit?: () => void;
  /** URL base sin query params. Defaults a /api/stock/productos. */
  baseUrl?: string;
  /** Para el uso superadmin: se añade como ?tenantId=xxx. */
  tenantId?: string;
}) {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const [nombre, setNombre] = useState(productoInicial?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(productoInicial?.descripcion ?? '');
  const [unidadMedida, setUnidadMedida] = useState(productoInicial?.unidadMedida ?? '');
  const [unidad1Nombre, setUnidad1Nombre] = useState(productoInicial?.unidad1Nombre ?? 'Pallets');
  const [unidad2Nombre, setUnidad2Nombre] = useState<string>(productoInicial?.unidad2Nombre ?? 'Unidad');
  const [tieneUnidad2, setTieneUnidad2] = useState(productoInicial ? productoInicial.unidad2Nombre !== null : true);
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
        unidad1Nombre: unidad1Nombre.trim() || 'Pallets',
        unidad2Nombre: tieneUnidad2 ? (unidad2Nombre.trim() || 'Unidad') : null,
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

  const readOnly = modo === 'view';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded border border-black/10 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-5 pt-5 pb-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
            {modo === 'create' ? 'Nuevo producto' : productoInicial?.nombre ?? 'Producto'}
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

        <div className="px-5 py-4 grid gap-3">
          {readOnly ? (
            <>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Nombre</p>
                <p className="mt-1 text-sm">{productoInicial?.nombre ?? '—'}</p>
              </div>
              {productoInicial?.codigo?.trim() && (
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Código</p>
                  <p className="mt-1 font-mono text-sm">{productoInicial.codigo}</p>
                </div>
              )}
              {productoInicial?.descripcion?.trim() && (
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Descripción</p>
                  <p className="mt-1 text-sm">{productoInicial.descripcion}</p>
                </div>
              )}
              {productoInicial?.unidadMedida && (
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Unidad de medida</p>
                  <p className="mt-1 text-sm">{productoInicial.unidadMedida}</p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Nombre cantidad 1</p>
                <p className="mt-1 text-sm">{productoInicial?.unidad1Nombre ?? 'Pallets'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Nombre cantidad 2</p>
                <p className="mt-1 text-sm">{productoInicial?.unidad2Nombre ?? '—'}</p>
              </div>
            </>
          ) : (
            <>
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
              <label className="flex flex-col gap-1 text-sm uppercase tracking-[0.08em] text-vialto-steel">
                Nombre cantidad 1
                <input
                  value={unidad1Nombre}
                  onChange={(e) => setUnidad1Nombre(e.target.value)}
                  placeholder="Ej. Pallets, Kg, Cajas…"
                  className="h-9 border border-black/15 px-2 text-sm"
                />
              </label>
              <div className="flex flex-col gap-1">
                <label className="flex items-center gap-2 text-sm uppercase tracking-[0.08em] text-vialto-steel cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tieneUnidad2}
                    onChange={(e) => setTieneUnidad2(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Usar segunda cantidad
                </label>
                {tieneUnidad2 && (
                  <input
                    value={unidad2Nombre}
                    onChange={(e) => setUnidad2Nombre(e.target.value)}
                    placeholder="Ej. Unidad, Unidades, Bolsas…"
                    className="h-9 border border-black/15 px-2 text-sm"
                  />
                )}
              </div>
            </>
          )}
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
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </button>
          {readOnly ? (
            <button
              type="button"
              onClick={onEdit}
              className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
            >
              Editar
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void submit()}
              className="inline-flex items-center gap-2 h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
            >
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
