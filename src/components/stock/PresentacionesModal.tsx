import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '@/lib/api';
import { useAbmToast } from '@/hooks/useAbmToast';
import { abmToast, EL } from '@/lib/toastAbm';
import { UNIDADES_PRODUCTO_OPCIONES } from '@/lib/unidadesProducto';
import type { Presentacion, Producto } from '@/types/api';

export function PresentacionesModal({
  producto,
  getToken,
  onClose,
  puedeGestionar = true,
  onPresentacionCreada,
  baseUrl = '/api/stock/productos',
  tenantId,
}: {
  producto: Producto;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  puedeGestionar?: boolean;
  /** Llamado cuando se crea una presentación nueva (para auto-selección). */
  onPresentacionCreada?: (p: Presentacion) => void;
  /** URL base del catálogo de productos (sin el /{id}/presentaciones). */
  baseUrl?: string;
  tenantId?: string;
}) {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const presentacionesUrl = `${baseUrl}/${encodeURIComponent(producto.id)}/presentaciones`;

  const [rows, setRows] = useState<Presentacion[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<Presentacion | null>(null);
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const abm = useAbmToast();

  const load = useCallback(async () => {
    try {
      const data = await apiJson<Presentacion[]>(`${presentacionesUrl}${qs}`, () => getToken());
      setRows(data);
      setLoadError(null);
    } catch (e) {
      setLoadError(abm.fail(e, 'stock'));
    }
  }, [presentacionesUrl, qs, getToken]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditRow(null);
    setNombre(''); setCantidad(''); setUnidad('');
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(p: Presentacion) {
    setEditRow(p);
    setNombre(p.nombre);
    setCantidad(String(p.cantidadEquivalente));
    setUnidad(p.unidadEquivalente);
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm() {
    if (!nombre.trim()) { setFormError('El nombre es obligatorio.'); return; }
    const cantidadNum = parseFloat(cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) { setFormError('La cantidad debe ser un número positivo.'); return; }
    if (!unidad.trim()) { setFormError('La unidad equivalente es obligatoria.'); return; }

    setSaving(true); setFormError(null);
    try {
      const body = {
        nombre: nombre.trim(),
        cantidadEquivalente: cantidadNum,
        unidadEquivalente: unidad.trim(),
      };
      if (editRow) {
        await apiJson(
          `${presentacionesUrl}/${encodeURIComponent(editRow.id)}${qs}`,
          () => getToken(),
          { method: 'PATCH', body: JSON.stringify(body) },
        );
        abm.success(abmToast.updated(EL.presentacion));
        setFormOpen(false);
        await load();
      } else {
        const created = await apiJson<Presentacion>(
          `${presentacionesUrl}${qs}`,
          () => getToken(),
          { method: 'POST', body: JSON.stringify(body) },
        );
        abm.success(abmToast.created(EL.presentacion));
        setFormOpen(false);
        await load();
        onPresentacionCreada?.(created);
      }
    } catch (e) {
      setFormError(abm.fail(e, 'stock'));
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(p: Presentacion) {
    if (!window.confirm(`¿Eliminar la presentación "${p.nombre}"?`)) return;
    try {
      await apiJson(
        `${presentacionesUrl}/${encodeURIComponent(p.id)}${qs}`,
        () => getToken(),
        { method: 'DELETE' },
      );
      abm.success(abmToast.deleted(EL.presentacion));
      await load();
    } catch (e) {
      setLoadError(abm.fail(e, 'stock'));
    }
  }

  const opcionesSelect = useMemo(() => {
    const out: { value: string; label: string }[] = UNIDADES_PRODUCTO_OPCIONES.map((o) => ({ value: o.value, label: o.label }));
    if (formOpen && unidad.trim() && !out.some((o) => o.value === unidad)) {
      out.push({ value: unidad, label: `${unidad} (valor previo)` });
    }
    return out;
  }, [formOpen, unidad]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded border border-black/10 bg-white p-5 shadow-lg max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
              Presentaciones
            </h2>
            <p className="text-sm text-vialto-steel mt-0.5">{producto.nombre}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-vialto-steel hover:text-vialto-charcoal text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {loadError && (
          <p className="mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
            {loadError}
          </p>
        )}

        <div className="overflow-y-auto flex-1 min-h-0">
          {rows.length === 0 ? (
            <p className="text-sm text-vialto-steel py-4">
              Este producto no tiene presentaciones definidas.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.18em] text-vialto-fire">
                  <th className="pb-2 pr-3">Nombre</th>
                  <th className="pb-2 pr-3">Equivale a</th>
                  {puedeGestionar && <th className="pb-2 text-right">Acc.</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-black/5 hover:bg-vialto-mist/70">
                    <td className="py-2 pr-3 font-medium">{p.nombre}</td>
                    <td className="py-2 pr-3 text-vialto-steel">
                      {p.cantidadEquivalente} {p.unidadEquivalente}
                    </td>
                    {puedeGestionar && (
                      <td className="py-2 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void eliminar(p)}
                          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 text-red-900 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {puedeGestionar && !formOpen && (
          <div className="mt-4 pt-4 border-t border-black/10">
            <button
              type="button"
              onClick={openCreate}
              className="h-9 px-4 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-graphite"
            >
              + Agregar presentación
            </button>
          </div>
        )}

        {formOpen && (
          <div className="mt-4 pt-4 border-t border-black/10 grid gap-3">
            <h3 className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.12em] text-vialto-charcoal">
              {editRow ? 'Editar presentación' : 'Nueva presentación'}
            </h3>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.08em] text-vialto-steel">
              Nombre
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Palet de 8 rollos"
                className="h-9 border border-black/15 px-2 text-sm"
                autoFocus
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.08em] text-vialto-steel">
                Cantidad equivalente
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="Ej. 8"
                  className="h-9 border border-black/15 px-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.08em] text-vialto-steel">
                Unidad equivalente
                <select
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value)}
                  className="h-9 border border-black/15 bg-white px-2 text-sm"
                >
                  <option value="">Seleccionar…</option>
                  {opcionesSelect.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {formError && (
              <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setFormOpen(false)}
                className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitForm()}
                className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
