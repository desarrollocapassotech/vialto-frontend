import { useCallback, useEffect, useState } from 'react';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { PresentacionFormModal } from '@/components/stock/PresentacionFormModal';
import { ApiError, apiJson } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyError } from '@/lib/friendlyError';
import { modalOverlayClass } from '@/lib/modalLayers';
import { useMaestroData } from '@/hooks/useMaestroData';
import { canAccessStock } from '@/lib/tenantModules';
import type { Presentacion, Producto } from '@/types/api';

const INPUT_CLASS = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const LABEL_CLASS = 'text-xs uppercase tracking-[0.08em] text-vialto-steel';

type PpRow = {
  _key: string;
  id?: string;        // ProductoPresentacion.id — present for existing rows
  presentacionId: string;
  unidadesPorBulto: string;
};

function newEmptyRow(): PpRow {
  return { _key: crypto.randomUUID(), presentacionId: '', unidadesPorBulto: '' };
}

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

  const { tenant, tenantLoading } = useMaestroData();
  const showStock = tenantId ? true : tenantLoading ? false : canAccessStock(tenant?.modules ?? []);

  const [nombre, setNombre] = useState(productoInicial?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(productoInicial?.descripcion ?? '');
  const [pesoStr, setPesoStr] = useState<string>(
    productoInicial?.pesoUnitarioKg != null ? String(productoInicial.pesoUnitarioKg) : '',
  );
  const [rows, setRows] = useState<PpRow[]>(() => {
    if (modo !== 'create' && productoInicial?.productoPresentaciones?.length) {
      return productoInicial.productoPresentaciones.map((pp) => ({
        _key: pp.id,
        id: pp.id,
        presentacionId: pp.presentacionId,
        unidadesPorBulto: String(pp.unidadesPorBulto),
      }));
    }
    return [newEmptyRow()];
  });

  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [presentacionesLoading, setPresentacionesLoading] = useState(true);
  const [newPpRowIdx, setNewPpRowIdx] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    if (!showStock || modo === 'view') return;
    void loadPresentaciones();
  }, [loadPresentaciones, showStock, modo]);

  // ─── Row helpers ─────────────────────────────────────────────────────────

  function addRow() {
    setRows((prev) => [...prev, newEmptyRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r._key !== key));
  }

  function updateRow(key: string, patch: Partial<Omit<PpRow, '_key'>>) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  // ─── Submit ──────────────────────────────────────────────────────────────

  async function submit() {
    const errs: Record<string, string> = {};

    if (!nombre.trim()) errs.nombre = 'Ingresá el nombre.';

    if (showStock) {
      const pesoNum = parseFloat(pesoStr);
      if (!pesoStr || isNaN(pesoNum) || pesoNum <= 0) {
        errs.peso = 'Ingresá el peso unitario (debe ser mayor a 0).';
      }
      if (rows.length === 0) {
        errs.presentaciones = 'Agregá al menos una presentación.';
      } else {
        for (const row of rows) {
          if (!row.presentacionId) {
            errs.presentaciones = 'Seleccioná una presentación para cada fila.';
            break;
          }
          const ub = parseInt(row.unidadesPorBulto, 10);
          if (!row.unidadesPorBulto || isNaN(ub) || ub < 1) {
            errs.presentaciones = 'Las unidades por bulto deben ser un número entero mayor o igual a 1.';
            break;
          }
        }
        if (!errs.presentaciones) {
          const presSet = new Set(rows.map((r) => r.presentacionId));
          if (presSet.size !== rows.length) {
            errs.presentaciones = 'No se pueden repetir presentaciones en el mismo producto.';
          }
        }
      }
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
      };
      if (showStock) {
        body.pesoUnitarioKg = parseFloat(pesoStr);
        body.presentaciones = rows.map((row) => ({
          ...(row.id ? { id: row.id } : {}),
          presentacionId: row.presentacionId,
          unidadesPorBulto: parseInt(row.unidadesPorBulto, 10),
        }));
      }

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
          ? e.message
          : friendlyError(e, 'stock'),
      );
    } finally {
      setSaving(false);
    }
  }

  const readOnly = modo === 'view';

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className={modalOverlayClass}>
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-lg rounded border border-black/10 bg-white shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/10 px-5 pt-5 pb-4">
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
              {modo === 'create' ? 'Nuevo producto' : (productoInicial?.nombre ?? 'Producto')}
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

          {/* Body */}
          <div className="px-5 py-4 grid gap-3 max-h-[65vh] overflow-y-auto">
            {readOnly ? (
              <>
                <div>
                  <p className={LABEL_CLASS}>Nombre</p>
                  <p className="mt-1 text-sm">{productoInicial?.nombre ?? '—'}</p>
                </div>
                {productoInicial?.codigo?.trim() && (
                  <div>
                    <p className={LABEL_CLASS}>Código</p>
                    <p className="mt-1 font-mono text-sm">{productoInicial.codigo}</p>
                  </div>
                )}
                {productoInicial?.descripcion?.trim() && (
                  <div>
                    <p className={LABEL_CLASS}>Descripción</p>
                    <p className="mt-1 text-sm">{productoInicial.descripcion}</p>
                  </div>
                )}
                {showStock && (
                  <>
                    <div>
                      <p className={LABEL_CLASS}>Peso unitario (kg)</p>
                      <p className="mt-1 text-sm">{productoInicial?.pesoUnitarioKg ?? '—'}</p>
                    </div>
                    <div>
                      <p className={LABEL_CLASS}>Presentaciones</p>
                      {!productoInicial?.productoPresentaciones?.length ? (
                        <p className="mt-1 text-sm">—</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {productoInicial.productoPresentaciones.map((pp) => (
                            <li key={pp.id} className="text-sm">
                              {pp.presentacion?.nombre ?? '—'}
                              <span className="text-vialto-steel">
                                {' '}— {pp.unidadesPorBulto} unidades dentro del bulto
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {/* Nombre */}
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>
                    Nombre <span className="text-red-500">*</span>
                  </span>
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Rollo de papel kraft"
                    className={`${INPUT_CLASS} ${fieldErrors.nombre ? 'border-red-400' : ''}`}
                    autoFocus
                  />
                  {fieldErrors.nombre && (
                    <span className="text-xs font-medium text-red-600">{fieldErrors.nombre}</span>
                  )}
                </label>

                {/* Descripción */}
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Descripción</span>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={2}
                    className="border border-black/15 px-2 py-2 text-sm"
                  />
                </label>

                {showStock && (
                  <>
                    {/* Peso unitario */}
                    <label className="flex flex-col gap-1">
                      <span className={LABEL_CLASS}>
                        Peso unitario (kg) <span className="text-red-500">*</span>
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={pesoStr}
                        onChange={(e) => setPesoStr(e.target.value)}
                        placeholder="Ej. 1.5"
                        className={`${INPUT_CLASS} ${fieldErrors.peso ? 'border-red-400' : ''}`}
                      />
                      {fieldErrors.peso && (
                        <span className="text-xs font-medium text-red-600">{fieldErrors.peso}</span>
                      )}
                    </label>

                    {/* Presentaciones */}
                    <div className="flex flex-col gap-2">
                      <span className={LABEL_CLASS}>
                        Presentaciones <span className="text-red-500">*</span>
                      </span>

                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_6rem_2rem] gap-2">
                        <span className="text-xs text-vialto-steel">Presentación</span>
                        <span className="text-xs text-vialto-steel">Unidades dentro del bulto</span>
                        <span />
                      </div>

                      {rows.map((row, idx) => (
                        <div key={row._key} className="grid grid-cols-[1fr_6rem_2rem] gap-2 items-start">
                          <SearchableEntitySelect<Presentacion>
                            items={presentaciones}
                            value={row.presentacionId}
                            onChange={(id) => updateRow(row._key, { presentacionId: id })}
                            loading={presentacionesLoading}
                            filterItems={(items, q) => {
                              const lq = q.toLowerCase();
                              return items.filter((p) => p.nombre.toLowerCase().includes(lq));
                            }}
                            getPrimaryLabel={(p) => p.nombre}
                            placeholderCerrado="Elegí una presentación…"
                            placeholderBuscar="Buscar presentación…"
                            inputClassName={`${INPUT_CLASS} ${fieldErrors.presentaciones ? 'border-red-400' : ''}`}
                            onNuevo={() => setNewPpRowIdx(idx)}
                            onNuevoLabel="+ Nueva"
                            aria-label={`Presentación fila ${idx + 1}`}
                          />
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={row.unidadesPorBulto}
                            onChange={(e) => updateRow(row._key, { unidadesPorBulto: e.target.value })}
                            placeholder="Ej. 10"
                            title="Unidades por bulto"
                            className={`${INPUT_CLASS} ${fieldErrors.presentaciones ? 'border-red-400' : ''}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeRow(row._key)}
                            disabled={rows.length <= 1}
                            className="h-9 w-8 flex items-center justify-center border border-black/20 text-vialto-steel hover:bg-vialto-mist disabled:opacity-30"
                            title="Eliminar fila"
                            aria-label={`Eliminar presentación ${idx + 1}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      {fieldErrors.presentaciones && (
                        <span className="text-xs font-medium text-red-600">
                          {fieldErrors.presentaciones}
                        </span>
                      )}

                      {(() => {
                        const last = rows[rows.length - 1];
                        const lastComplete =
                          last &&
                          Boolean(last.presentacionId) &&
                          Boolean(last.unidadesPorBulto) &&
                          parseInt(last.unidadesPorBulto, 10) >= 1;
                        return lastComplete ? (
                          <button
                            type="button"
                            onClick={addRow}
                            className="self-start text-xs uppercase tracking-wider text-vialto-steel border border-black/15 px-2 h-7 hover:bg-vialto-mist"
                          >
                            + Agregar presentación
                          </button>
                        ) : null;
                      })()}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Error API */}
          {error && (
            <p className="mx-5 mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">
              {error}
            </p>
          )}

          {/* Footer */}
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
              onEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
                >
                  Editar
                </button>
              ) : null
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

      {newPpRowIdx !== null && (
        <PresentacionFormModal
          modo="create"
          getToken={getToken}
          baseUrl={tenantId ? '/api/platform/stock/presentaciones' : '/api/stock/presentaciones'}
          tenantId={tenantId}
          onClose={() => setNewPpRowIdx(null)}
          onSaved={(p) => {
            setPresentaciones((prev) =>
              [...prev, p].sort((a, b) => a.nombre.localeCompare(b.nombre)),
            );
            const idx = newPpRowIdx;
            setRows((prev) =>
              prev.map((row, i) => (i === idx ? { ...row, presentacionId: p.id } : row)),
            );
            setNewPpRowIdx(null);
          }}
        />
      )}
    </>
  );
}
