import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Producto, PaginatedMeta } from '@/types/api';
import { etiquetaUnidadProducto } from '@/lib/unidadesProducto';
import { ProductoModal } from '@/components/stock/ProductoModal';
import { PresentacionesModal } from '@/components/stock/PresentacionesModal';

type Paginated = { items: Producto[]; meta: PaginatedMeta };

// ─── Modal modes ─────────────────────────────────────────────────────────────

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; producto: Producto }
  | { mode: 'presentaciones'; producto: Producto };

// ─── Main page ────────────────────────────────────────────────────────────────

export function ProductosTenantPage() {
  const { getToken, isLoaded, isSignedIn, orgRole } = useAuth();
  const puedeGestionar = orgRole === 'org:admin' || orgRole === 'org:supervisor';

  const [rows, setRows] = useState<Producto[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('activos');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });

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
      `/api/stock/productos/paginated?${params.toString()}`,
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
          setError(friendlyError(e, 'stock'));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, load]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced, filtroActivo]);

  async function toggleActivo(row: Producto) {
    const mensaje = row.activo
      ? `¿Desactivar "${row.nombre}"? Los movimientos históricos conservan el vínculo.`
      : `¿Reactivar "${row.nombre}"?`;
    if (!window.confirm(mensaje)) return;
    setError(null);
    try {
      await apiJson<Producto>(
        `/api/stock/productos/${encodeURIComponent(row.id)}`,
        () => getToken(),
        { method: 'PATCH', body: JSON.stringify({ activo: !row.activo }) },
      );
      await load();
    } catch (e) {
      setError(friendlyError(e, 'stock'));
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

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Productos
      </h1>
      <p className="mt-2 text-vialto-steel max-w-2xl">
        Catálogo único de productos del depósito. Se reutiliza en ingresos, egresos, divisiones
        de bultos y el panel de stock.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
            Buscar por nombre
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej. rollo kraft, palet…"
              className="h-9 w-56 border border-black/15 bg-white px-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
            Estado
            <select
              value={filtroActivo}
              onChange={(e) => setFiltroActivo(e.target.value as 'todos' | 'activos' | 'inactivos')}
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
            onClick={() => setModal({ mode: 'create' })}
            className="h-10 px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Nuevo producto
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
        {qDebounced ? ` · búsqueda: "${qDebounced}"` : ''}
      </p>

      <div className="mt-4 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Unidad</th>
              <th className="px-4 py-3">Presentaciones</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-vialto-steel">Cargando…</td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                  No hay productos que coincidan con el criterio.
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
                  {etiquetaUnidadProducto(r.unidadMedida)}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setModal({ mode: 'presentaciones', producto: r })}
                    className="text-xs uppercase tracking-wider text-vialto-fire hover:underline"
                  >
                    Ver / gestionar
                  </button>
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
                        onClick={() => setModal({ mode: 'edit', producto: r })}
                        className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                      >
                        Editar
                      </button>
                      {r.activo ? (
                        <button
                          type="button"
                          onClick={() => void toggleActivo(r)}
                          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 text-red-900 hover:bg-red-50"
                        >
                          Desactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void toggleActivo(r)}
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

      {modal.mode === 'create' && (
        <ProductoModal
          modo="create"
          getToken={getToken}
          onClose={() => setModal({ mode: 'closed' })}
          onSaved={async (_p) => {
            setModal({ mode: 'closed' });
            await load();
          }}
        />
      )}

      {modal.mode === 'edit' && (
        <ProductoModal
          modo="edit"
          productoInicial={modal.producto}
          getToken={getToken}
          onClose={() => setModal({ mode: 'closed' })}
          onSaved={async (_p) => {
            setModal({ mode: 'closed' });
            await load();
          }}
        />
      )}

      {modal.mode === 'presentaciones' && (
        <PresentacionesModal
          producto={modal.producto}
          getToken={getToken}
          puedeGestionar={puedeGestionar}
          onClose={() => setModal({ mode: 'closed' })}
        />
      )}
    </div>
  );
}
