import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { TipoCargaNuevoModal } from '@/components/viajes/CargaNuevoModal';
import type { Carga, PaginatedMeta } from '@/types/api';
import {
  UNIDADES_MEDIDA_CARGA_OPCIONES,
  etiquetaUnidadMedidaCarga,
} from '@/lib/unidadesMedidaCarga';

type Paginated = { items: Carga[]; meta: PaginatedMeta };

export function TiposCargaTenantPage() {
  const { getToken, isLoaded, isSignedIn, orgRole } = useAuth();
  const puedeGestionar = orgRole === 'org:admin' || orgRole === 'org:supervisor';

  const [rows, setRows] = useState<Carga[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos');

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      filtroActivo,
    });
    if (qDebounced) params.set('q', qDebounced);
    const data = await apiJson<Paginated>(
      `/api/cargas/paginated?${params.toString()}`,
      () => getToken(),
    );
    setRows(data.items);
    setMeta(data.meta);
  }, [getToken, isLoaded, isSignedIn, page, pageSize, qDebounced, filtroActivo]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        await load();
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setMeta(null);
          setError(friendlyError(e, 'cargas'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, load]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced, filtroActivo]);

  function openCreate() {
    setEditId(null);
    setNombre('');
    setDescripcion('');
    setUnidadMedida('');
    setModalError(null);
    setModalOpen(true);
  }

  function openEdit(row: Carga) {
    setEditId(row.id);
    setNombre(row.nombre);
    setDescripcion(row.descripcion ?? '');
    setUnidadMedida(row.unidadMedida ?? '');
    setModalError(null);
    setModalOpen(true);
  }

  async function submitModal() {
    if (!editId) return;
    if (!nombre.trim()) {
      setModalError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      await apiJson<Carga>(`/api/cargas/${encodeURIComponent(editId)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          unidadMedida: unidadMedida.trim() || undefined,
        }),
      });
      setModalOpen(false);
      await load();
    } catch (e) {
      setModalError(
        e instanceof ApiError && e.status === 409
          ? 'Ya existe una carga con ese nombre (sin distinguir mayúsculas).'
          : friendlyError(e, 'cargas'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function desactivar(row: Carga) {
    if (!window.confirm(`¿Desactivar "${row.nombre}"? Los viajes que lo usan conservan el vínculo.`)) {
      return;
    }
    setError(null);
    try {
      await apiJson<Carga>(`/api/cargas/${encodeURIComponent(row.id)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({ activo: false }),
      });
      await load();
    } catch (e) {
      setError(friendlyError(e, 'cargas'));
    }
  }

  async function reactivar(row: Carga) {
    setError(null);
    try {
      await apiJson<Carga>(`/api/cargas/${encodeURIComponent(row.id)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({ activo: true }),
      });
      await load();
    } catch (e) {
      setError(friendlyError(e, 'cargas'));
    }
  }

  const filtroLabel = useMemo(
    () =>
      ({
        todos: 'Todos',
        activos: 'Solo activos',
        inactivos: 'Solo inactivos',
      })[filtroActivo],
    [filtroActivo],
  );

  const opcionesSelectUnidad = useMemo(() => {
    const out: Array<{ value: string; label: string }> = UNIDADES_MEDIDA_CARGA_OPCIONES.map((o) => ({
      value: o.value,
      label: o.label,
    }));
    if (modalOpen && unidadMedida.trim() && !out.some((o) => o.value === unidadMedida)) {
      out.push({
        value: unidadMedida,
        label: `${unidadMedida} (valor previo)`,
      });
    }
    return out;
  }, [modalOpen, unidadMedida]);

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Cargas
      </h1>
      <p className="mt-2 text-vialto-steel max-w-2xl">
        Catálogo único de cargas transportables para viajes. Las inactivas no se ofrecen en
        altas nuevas, pero siguen vinculadas a viajes históricos.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
            Buscar por nombre
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej. soja, pallets…"
              className="h-9 w-56 border border-black/15 bg-white px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
            Estado
            <select
              value={filtroActivo}
              onChange={(e) =>
                setFiltroActivo(e.target.value as 'todos' | 'activos' | 'inactivos')
              }
              className="h-9 border border-black/15 bg-white px-2 text-sm min-w-[10rem]"
            >
              <option value="todos">Todos</option>
              <option value="activos">Solo activos</option>
              <option value="inactivos">Solo inactivos</option>
            </select>
          </label>
        </div>
        {puedeGestionar && (
          <button
            type="button"
            onClick={openCreate}
            className="h-10 px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Nueva carga
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <p className="mt-2 text-xs text-vialto-steel">
        Filtro: {filtroLabel}
        {qDebounced ? ` · búsqueda: “${qDebounced}”` : ''}
      </p>

      <div className="mt-4 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Unidad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && !error && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-vialto-steel">
                  No hay cargas que coincidan con el criterio.
                </td>
              </tr>
            )}
            {rows?.map((r) => (
              <tr key={r.id} className="border-b border-black/5 hover:bg-vialto-mist/80">
                <td className="px-4 py-3">
                  <div className="font-[family-name:var(--font-ui)] font-semibold tracking-wide">
                    {r.nombre}
                  </div>
                  {r.descripcion?.trim() ? (
                    <div className="mt-0.5 text-xs text-vialto-steel line-clamp-2">{r.descripcion}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-vialto-steel">
                  {etiquetaUnidadMedidaCarga(r.unidadMedida)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      r.activo
                        ? 'text-xs uppercase tracking-wider text-emerald-800'
                        : 'text-xs uppercase tracking-wider text-vialto-steel'
                    }
                  >
                    {r.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {puedeGestionar && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                      >
                        Editar
                      </button>
                      {r.activo ? (
                        <button
                          type="button"
                          onClick={() => void desactivar(r)}
                          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 text-red-900 hover:bg-red-50"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void reactivar(r)}
                          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 text-emerald-900 hover:bg-emerald-50"
                        >
                          Reactivar
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-vialto-steel">
              Página {meta.page} de {meta.totalPages} · {meta.total} registros
            </p>
            <label className="text-xs uppercase tracking-wider text-vialto-steel flex items-center gap-2">
              Mostrar
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 border border-black/20 bg-white px-2 text-xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          <div className="inline-flex gap-2">
            <button
              type="button"
              disabled={!meta.hasPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!meta.hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {modalOpen && editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded border border-black/10 bg-white p-5 shadow-lg"
          >
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
              Editar carga
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
                  {opcionesSelectUnidad.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {modalError && (
              <p className="mt-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">
                {modalError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModalOpen(false)}
                className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitModal()}
                className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {modalOpen && !editId && puedeGestionar && (
        <TipoCargaNuevoModal
          open
          onClose={() => setModalOpen(false)}
          nombreInicial=""
          getToken={getToken}
          onCreated={async () => {
            setModalOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
