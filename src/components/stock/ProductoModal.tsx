import { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { PresentacionFormModal } from '@/components/stock/PresentacionFormModal';
import { ApiError, apiJson } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyError } from '@/lib/friendlyError';
import { modalOverlayClass } from '@/lib/modalLayers';
import type { Presentacion, Producto } from '@/types/api';

const SELECT_CLASS = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';

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
  onEdit?: () => void;
  baseUrl?: string;
  tenantId?: string;
}) {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  const presentacionesUrl = tenantId
    ? `/api/platform/stock/presentaciones?tenantId=${encodeURIComponent(tenantId)}&activo=1`
    : '/api/stock/presentaciones?activo=1';

  const [nombre, setNombre] = useState(productoInicial?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(productoInicial?.descripcion ?? '');
  const [presentacion1Id, setPresentacion1Id] = useState(productoInicial?.presentacion1Id ?? '');
  const [presentacion2Id, setPresentacion2Id] = useState(productoInicial?.presentacion2Id ?? '');
  const [tieneUnidad2, setTieneUnidad2] = useState(
    productoInicial ? productoInicial.presentacion2Id !== null : false,
  );
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [presentacionesLoading, setPresentacionesLoading] = useState(true);
  const [modalPresentacion, setModalPresentacion] = useState<'closed' | 'cant1' | 'cant2'>('closed');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPresentaciones = useCallback(async () => {
    setPresentacionesLoading(true);
    try {
      const data = await apiJson<Presentacion[]>(presentacionesUrl, () => getToken());
      setPresentaciones(data);
    } catch {
      setPresentaciones([]);
    } finally {
      setPresentacionesLoading(false);
    }
  }, [presentacionesUrl, getToken]);

  useEffect(() => {
    void loadPresentaciones();
  }, [loadPresentaciones]);

  async function submit() {
    if (!nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!presentacion1Id) {
      setError('Seleccioná una presentación para cantidad 1.');
      return;
    }
    if (tieneUnidad2 && !presentacion2Id) {
      setError('Seleccioná una presentación para cantidad 2.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        presentacion1Id,
        presentacion2Id: tieneUnidad2 ? presentacion2Id : null,
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

  const presentacionesCant2 = useMemo(
    () => presentaciones.filter((p) => p.id !== presentacion1Id),
    [presentaciones, presentacion1Id],
  );

  function handlePresentacion1Change(id: string) {
    setPresentacion1Id(id);
    if (id && id === presentacion2Id) setPresentacion2Id('');
  }

  return (
    <>
      <div className={modalOverlayClass}>
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
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Cantidad 1</p>
                  <p className="mt-1 text-sm">{productoInicial?.unidad1Nombre ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Cantidad 2</p>
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
                <div className="flex flex-col gap-1">
                  <span className="text-sm uppercase tracking-[0.08em] text-vialto-steel">
                    Presentación cantidad 1 *
                  </span>
                  <SearchableEntitySelect<Presentacion>
                    items={presentaciones}
                    value={presentacion1Id}
                    onChange={handlePresentacion1Change}
                    loading={presentacionesLoading}
                    filterItems={(items, q) => {
                      const lq = q.toLowerCase();
                      return items.filter((p) => p.nombre.toLowerCase().includes(lq));
                    }}
                    getPrimaryLabel={(p) => p.nombre}
                    placeholderCerrado="Elegí una presentación…"
                    placeholderBuscar="Buscar presentación…"
                    inputClassName={SELECT_CLASS}
                    onNuevo={() => setModalPresentacion('cant1')}
                    onNuevoLabel="+ Nueva presentación"
                    aria-label="Presentación para cantidad 1"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="flex items-center gap-2 text-sm uppercase tracking-[0.08em] text-vialto-steel cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tieneUnidad2}
                      onChange={(e) => {
                        setTieneUnidad2(e.target.checked);
                        if (!e.target.checked) setPresentacion2Id('');
                      }}
                      className="h-4 w-4"
                    />
                    Usar segunda cantidad
                  </label>
                  {tieneUnidad2 && (
                    <SearchableEntitySelect<Presentacion>
                      items={presentacionesCant2}
                      value={presentacion2Id}
                      onChange={setPresentacion2Id}
                      loading={presentacionesLoading}
                      filterItems={(items, q) => {
                        const lq = q.toLowerCase();
                        return items.filter((p) => p.nombre.toLowerCase().includes(lq));
                      }}
                      getPrimaryLabel={(p) => p.nombre}
                      placeholderCerrado="Elegí una presentación…"
                      placeholderBuscar="Buscar presentación…"
                      inputClassName={SELECT_CLASS}
                      onNuevo={() => setModalPresentacion('cant2')}
                      onNuevoLabel="+ Nueva presentación"
                      aria-label="Presentación para cantidad 2"
                    />
                  )}
                </div>
                {presentaciones.length === 0 && !presentacionesLoading && (
                  <p className="text-xs text-vialto-steel">
                    No hay presentaciones activas. Creá una desde acá o en Base de datos → Presentaciones.
                  </p>
                )}
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

      {modalPresentacion !== 'closed' && (
        <PresentacionFormModal
          modo="create"
          getToken={getToken}
          baseUrl={tenantId ? '/api/platform/stock/presentaciones' : '/api/stock/presentaciones'}
          tenantId={tenantId}
          onClose={() => setModalPresentacion('closed')}
          onSaved={(p) => {
            setPresentaciones((prev) => [...prev, p].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            if (modalPresentacion === 'cant1') {
              handlePresentacion1Change(p.id);
            }
            if (modalPresentacion === 'cant2') setPresentacion2Id(p.id);
            setModalPresentacion('closed');
          }}
        />
      )}
    </>
  );
}
