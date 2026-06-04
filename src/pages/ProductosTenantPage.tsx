import { useAuth, useUser } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Producto, PaginatedMeta } from '@/types/api';
import { etiquetaUnidadProducto, UNIDADES_PRODUCTO_OPCIONES } from '@/lib/unidadesProducto';
import { ProductoModal } from '@/components/stock/ProductoModal';
import { ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { puedeGestionarComoAdminEmpresa } from '@/lib/roleLabels';

type Paginated = { items: Producto[]; meta: PaginatedMeta };

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'view'; producto: Producto }
  | { mode: 'edit'; producto: Producto };

export function ProductosTenantPage() {
  const { getToken, isLoaded, isSignedIn, orgRole } = useAuth();
  const { user } = useUser();
  const puedeGestionar = puedeGestionarComoAdminEmpresa(orgRole, user?.publicMetadata);

  const [rows, setRows] = useState<Producto[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [codigoFiltroInput, setCodigoFiltroInput] = useState('');
  const [codigoFiltro, setCodigoFiltro] = useState('');
  const [nombreFiltroInput, setNombreFiltroInput] = useState('');
  const [nombreFiltro, setNombreFiltro] = useState('');
  const [unidadFiltro, setUnidadFiltro] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('todos');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });

  const load = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return;
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      filtroActivo,
    });
    if (codigoFiltro) params.set('codigo', codigoFiltro);
    if (nombreFiltro) params.set('q', nombreFiltro);
    if (unidadFiltro) params.set('unidadMedida', unidadFiltro);
    const data = await apiJson<Paginated>(
      `/api/stock/productos/paginated?${params.toString()}`,
      () => getToken(),
    );
    setRows(data.items);
    setMeta(data.meta);
  }, [getToken, isLoaded, isSignedIn, page, pageSize, codigoFiltro, nombreFiltro, unidadFiltro, filtroActivo]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
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
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, load]);

  useEffect(() => {
    setPage(1);
  }, [codigoFiltro, nombreFiltro, unidadFiltro, filtroActivo]);

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

  const anyFiltroActivo = useMemo(
    () =>
      Boolean(codigoFiltro.trim()) ||
      Boolean(nombreFiltro.trim()) ||
      Boolean(unidadFiltro) ||
      filtroActivo !== 'todos',
    [codigoFiltro, nombreFiltro, unidadFiltro, filtroActivo],
  );

  function limpiarFiltros() {
    setCodigoFiltroInput('');
    setCodigoFiltro('');
    setNombreFiltroInput('');
    setNombreFiltro('');
    setUnidadFiltro('');
    setFiltroActivo('todos');
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Productos
      </h1>
      <p className="mt-2 text-vialto-steel max-w-2xl">
        {'Catálogo de productos del depósito.'}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        {anyFiltroActivo && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
          >
            Limpiar filtros
          </button>
        )}
        {puedeGestionar && (
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
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

      <div className="mt-4 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire">
              <th scope="col" className="px-4 py-3 align-top">
                <ViajesListadoHeaderFiltro
                  title="Código"
                  filterActive={!!codigoFiltro.trim()}
                  filterSignature={codigoFiltro}
                >
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={codigoFiltroInput}
                      onChange={(e) => setCodigoFiltroInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setCodigoFiltro(codigoFiltroInput.trim());
                      }}
                      placeholder="Buscar…"
                      className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 font-mono text-sm ${
                        codigoFiltro.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'
                      }`}
                      aria-label="Filtrar por código de producto"
                    />
                    <button
                      type="button"
                      onClick={() => setCodigoFiltro(codigoFiltroInput.trim())}
                      className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                    >
                      OK
                    </button>
                  </div>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top">
                <ViajesListadoHeaderFiltro
                  title="Nombre"
                  filterActive={!!nombreFiltro.trim()}
                  filterSignature={nombreFiltro}
                >
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={nombreFiltroInput}
                      onChange={(e) => setNombreFiltroInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setNombreFiltro(nombreFiltroInput.trim());
                      }}
                      placeholder="Buscar…"
                      className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
                        nombreFiltro.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'
                      }`}
                      aria-label="Filtrar por nombre de producto"
                    />
                    <button
                      type="button"
                      onClick={() => setNombreFiltro(nombreFiltroInput.trim())}
                      className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                    >
                      OK
                    </button>
                  </div>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top">
                <ViajesListadoHeaderFiltro
                  title="Unidad"
                  filterActive={!!unidadFiltro}
                  filterSignature={unidadFiltro}
                >
                  <select
                    value={unidadFiltro}
                    onChange={(e) => setUnidadFiltro(e.target.value)}
                    className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      unidadFiltro ? 'text-vialto-fire' : 'text-vialto-charcoal'
                    }`}
                    aria-label="Filtrar por unidad de medida"
                  >
                    <option value="">Todas</option>
                    {UNIDADES_PRODUCTO_OPCIONES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top">
                <ViajesListadoHeaderFiltro
                  title="Estado"
                  filterActive={filtroActivo !== 'todos'}
                  filterSignature={filtroActivo}
                >
                  <select
                    value={filtroActivo}
                    onChange={(e) =>
                      setFiltroActivo(e.target.value as 'todos' | 'activos' | 'inactivos')
                    }
                    className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      filtroActivo !== 'todos' ? 'text-vialto-fire' : 'text-vialto-charcoal'
                    }`}
                    aria-label="Filtrar por estado del producto"
                  >
                    <option value="todos">Todos</option>
                    <option value="activos">Solo activos</option>
                    <option value="inactivos">Solo inactivos</option>
                  </select>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 text-right align-top">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {rows === null && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
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
                <td className="px-4 py-3 font-mono text-sm text-vialto-steel">
                  {r.codigo ?? '—'}
                </td>
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
                  <button
                    type="button"
                    onClick={() => setModal({ mode: 'view', producto: r })}
                    className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                  >
                    Ver
                  </button>
                  {puedeGestionar && (
                    <>
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
          onSaved={async () => {
            setModal({ mode: 'closed' });
            await load();
          }}
        />
      )}

      {modal.mode === 'view' && (
        <ProductoModal
          modo="view"
          productoInicial={modal.producto}
          getToken={getToken}
          onClose={() => setModal({ mode: 'closed' })}
          onSaved={() => {}}
          onEdit={puedeGestionar ? () => setModal({ mode: 'edit', producto: modal.producto }) : undefined}
        />
      )}

      {modal.mode === 'edit' && (
        <ProductoModal
          modo="edit"
          productoInicial={modal.producto}
          getToken={getToken}
          onClose={() => setModal({ mode: 'closed' })}
          onSaved={async () => {
            setModal({ mode: 'closed' });
            await load();
          }}
        />
      )}

    </div>
  );
}
