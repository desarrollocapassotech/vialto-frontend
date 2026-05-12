import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { ApiError, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Producto, Presentacion, PaginatedMeta } from '@/types/api';
import {
  UNIDADES_PRODUCTO_OPCIONES,
  etiquetaUnidadProducto,
} from '@/lib/unidadesProducto';

type Paginated = { items: Producto[]; meta: PaginatedMeta };

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; producto: Producto }
  | { mode: 'presentaciones'; producto: Producto };

// ─── Presentaciones panel (superadmin) ───────────────────────────────────────

function PresentacionesPanel({
  producto,
  tenantId,
  getToken,
  onClose,
}: {
  producto: Producto;
  tenantId: string;
  getToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Presentacion[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<Presentacion | null>(null);
  const [nombre, setNombre] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidad, setUnidad] = useState('');
  const [pesoKg, setPesoKg] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const base = `/api/platform/stock/productos/${encodeURIComponent(producto.id)}/presentaciones?tenantId=${encodeURIComponent(tenantId)}`;

  const load = useCallback(async () => {
    try {
      const data = await apiJson<Presentacion[]>(base, () => getToken());
      setRows(data);
      setLoadError(null);
    } catch (e) {
      setLoadError(friendlyError(e, 'plataforma'));
    }
  }, [base, getToken]);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditRow(null); setNombre(''); setCantidad(''); setUnidad(''); setPesoKg('');
    setFormError(null); setFormOpen(true);
  }

  function openEdit(p: Presentacion) {
    setEditRow(p); setNombre(p.nombre); setCantidad(String(p.cantidadEquivalente));
    setUnidad(p.unidadEquivalente); setPesoKg(p.pesoKg !== null ? String(p.pesoKg) : '');
    setFormError(null); setFormOpen(true);
  }

  async function submitForm() {
    if (!nombre.trim()) { setFormError('El nombre es obligatorio.'); return; }
    const cantidadNum = parseFloat(cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) { setFormError('La cantidad debe ser un número positivo.'); return; }
    if (!unidad.trim()) { setFormError('La unidad equivalente es obligatoria.'); return; }
    const pesoNum = pesoKg.trim() ? parseFloat(pesoKg) : undefined;
    if (pesoKg.trim() && (isNaN(pesoNum!) || pesoNum! < 0)) { setFormError('El peso debe ser ≥ 0.'); return; }

    setSaving(true); setFormError(null);
    try {
      const body = { nombre: nombre.trim(), cantidadEquivalente: cantidadNum, unidadEquivalente: unidad.trim(), ...(pesoNum !== undefined ? { pesoKg: pesoNum } : {}) };
      if (editRow) {
        await apiJson(`/api/platform/stock/productos/${encodeURIComponent(producto.id)}/presentaciones/${encodeURIComponent(editRow.id)}?tenantId=${encodeURIComponent(tenantId)}`, () => getToken(), { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiJson(base, () => getToken(), { method: 'POST', body: JSON.stringify(body) });
      }
      setFormOpen(false); await load();
    } catch (e) { setFormError(friendlyError(e, 'plataforma')); }
    finally { setSaving(false); }
  }

  async function eliminar(p: Presentacion) {
    if (!window.confirm(`¿Eliminar "${p.nombre}"?`)) return;
    try {
      await apiJson(`/api/platform/stock/productos/${encodeURIComponent(producto.id)}/presentaciones/${encodeURIComponent(p.id)}?tenantId=${encodeURIComponent(tenantId)}`, () => getToken(), { method: 'DELETE' });
      await load();
    } catch (e) { setLoadError(friendlyError(e, 'plataforma')); }
  }

  const opcionesSelect = useMemo(() => {
    const out: { value: string; label: string }[] = UNIDADES_PRODUCTO_OPCIONES.map((o) => ({ value: o.value, label: o.label }));
    if (formOpen && unidad.trim() && !out.some((o) => o.value === unidad)) out.push({ value: unidad, label: `${unidad} (valor previo)` });
    return out;
  }, [formOpen, unidad]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-xl rounded border border-black/10 bg-white p-5 shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">Presentaciones</h2>
            <p className="text-sm text-vialto-steel mt-0.5">{producto.nombre}</p>
          </div>
          <button type="button" onClick={onClose} className="text-vialto-steel hover:text-vialto-charcoal text-lg leading-none">✕</button>
        </div>
        {loadError && <p className="mb-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">{loadError}</p>}
        <div className="overflow-y-auto flex-1 min-h-0">
          {rows.length === 0 ? (
            <p className="text-sm text-vialto-steel py-4">Sin presentaciones.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.18em] text-vialto-fire">
                  <th className="pb-2 pr-3">Nombre</th>
                  <th className="pb-2 pr-3">Equivale a</th>
                  <th className="pb-2 pr-3">Peso (kg)</th>
                  <th className="pb-2 text-right">Acc.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-black/5 hover:bg-vialto-mist/70">
                    <td className="py-2 pr-3 font-medium">{p.nombre}</td>
                    <td className="py-2 pr-3 text-vialto-steel">{p.cantidadEquivalente} {p.unidadEquivalente}</td>
                    <td className="py-2 pr-3 text-vialto-steel">{p.pesoKg !== null ? `${p.pesoKg} kg` : '—'}</td>
                    <td className="py-2 text-right space-x-2">
                      <button type="button" onClick={() => openEdit(p)} className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist">Editar</button>
                      <button type="button" onClick={() => void eliminar(p)} className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 text-red-900 hover:bg-red-50">Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!formOpen && (
          <div className="mt-4 pt-4 border-t border-black/10">
            <button type="button" onClick={openCreate} className="h-9 px-4 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-graphite">+ Agregar presentación</button>
          </div>
        )}
        {formOpen && (
          <div className="mt-4 pt-4 border-t border-black/10 grid gap-3">
            <h3 className="text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.12em] text-vialto-charcoal">{editRow ? 'Editar presentación' : 'Nueva presentación'}</h3>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.08em] text-vialto-steel">
              Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-9 border border-black/15 px-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.08em] text-vialto-steel">
                Cantidad equivalente
                <input type="number" min="0.001" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} className="h-9 border border-black/15 px-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.08em] text-vialto-steel">
                Unidad equivalente
                <select value={unidad} onChange={(e) => setUnidad(e.target.value)} className="h-9 border border-black/15 bg-white px-2 text-sm">
                  <option value="">Seleccionar…</option>
                  {opcionesSelect.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-[0.08em] text-vialto-steel">
              Peso kg (opcional)
              <input type="number" min="0" step="any" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} className="h-9 border border-black/15 px-2 text-sm" />
            </label>
            {formError && <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setFormOpen(false)} className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50">Cancelar</button>
              <button type="button" disabled={saving} onClick={() => void submitForm()} className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Producto modal ───────────────────────────────────────────────────────────

function ProductoModal({
  modo,
  productoInicial,
  tenantId,
  getToken,
  onClose,
  onSaved,
}: {
  modo: 'create' | 'edit';
  productoInicial?: Producto;
  tenantId: string;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(productoInicial?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(productoInicial?.descripcion ?? '');
  const [unidadMedida, setUnidadMedida] = useState(productoInicial?.unidadMedida ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const opcionesSelect = useMemo(() => {
    const out: { value: string; label: string }[] = UNIDADES_PRODUCTO_OPCIONES.map((o) => ({ value: o.value, label: o.label }));
    if (unidadMedida.trim() && !out.some((o) => o.value === unidadMedida)) out.push({ value: unidadMedida, label: `${unidadMedida} (valor previo)` });
    return out;
  }, [unidadMedida]);

  async function submit() {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true); setError(null);
    try {
      const body = { nombre: nombre.trim(), descripcion: descripcion.trim() || undefined, unidadMedida: unidadMedida.trim() || undefined };
      const qs = `?tenantId=${encodeURIComponent(tenantId)}`;
      if (modo === 'create') {
        await apiJson<Producto>(`/api/platform/stock/productos${qs}`, () => getToken(), { method: 'POST', body: JSON.stringify(body) });
      } else {
        await apiJson<Producto>(`/api/platform/stock/productos/${encodeURIComponent(productoInicial!.id)}${qs}`, () => getToken(), { method: 'PATCH', body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Ya existe un producto con ese nombre (sin distinguir mayúsculas).'
          : friendlyError(e, 'plataforma'),
      );
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded border border-black/10 bg-white p-5 shadow-lg">
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">{modo === 'create' ? 'Nuevo producto' : 'Editar producto'}</h2>
        <div className="mt-4 grid gap-3">
          <label className="flex flex-col gap-1 text-sm uppercase tracking-[0.08em] text-vialto-steel">
            Nombre *
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="h-9 border border-black/15 px-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm uppercase tracking-[0.08em] text-vialto-steel">
            Descripción (opcional)
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="border border-black/15 px-2 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm uppercase tracking-[0.08em] text-vialto-steel">
            Unidad de medida (opcional)
            <select value={unidadMedida} onChange={(e) => setUnidadMedida(e.target.value)} className="h-9 border border-black/15 bg-white px-2 text-sm">
              <option value="">Sin unidad</option>
              {opcionesSelect.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={onClose} className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={saving} onClick={() => void submit()} className="h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ProductosSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const tenants = useTenantsList();

  const [filtroEmpresa, setFiltroEmpresa] = useState('');
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
    if (!isLoaded || !isSignedIn || !filtroEmpresa) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), filtroActivo, tenantId: filtroEmpresa });
    if (qDebounced) params.set('q', qDebounced);
    const data = await apiJson<Paginated>(`/api/platform/stock/productos/paginated?${params.toString()}`, () => getToken());
    setRows(data.items);
    setMeta(data.meta);
  }, [getToken, isLoaded, isSignedIn, filtroEmpresa, page, pageSize, qDebounced, filtroActivo]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) { setRows(null); setMeta(null); setError(null); return; }
    let cancelled = false;
    (async () => {
      try { await load(); if (!cancelled) setError(null); }
      catch (e) { if (!cancelled) { setRows(null); setMeta(null); setError(friendlyError(e, 'plataforma')); } }
    })();
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, load, filtroEmpresa]);

  useEffect(() => { setPage(1); }, [qDebounced, filtroActivo, filtroEmpresa]);

  async function toggleActivo(row: Producto) {
    const mensaje = row.activo
      ? `¿Desactivar "${row.nombre}"? Los movimientos históricos conservan el vínculo.`
      : `¿Reactivar "${row.nombre}"?`;
    if (!window.confirm(mensaje)) return;
    setError(null);
    try {
      await apiJson<Producto>(
        `/api/platform/stock/productos/${encodeURIComponent(row.id)}?tenantId=${encodeURIComponent(filtroEmpresa)}`,
        () => getToken(),
        { method: 'PATCH', body: JSON.stringify({ activo: !row.activo }) },
      );
      await load();
    } catch (e) { setError(friendlyError(e, 'plataforma')); }
  }

  const filtroLabel = useMemo(
    () => ({ todos: 'Todos', activos: 'Solo activos', inactivos: 'Solo inactivos' })[filtroActivo],
    [filtroActivo],
  );

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Productos
      </h1>
      <p className="mt-2 text-vialto-steel max-w-2xl">
        Catálogo de productos por empresa. Elegí una empresa para gestionar su catálogo.
      </p>

      <div className="mt-6">
        <EmpresaFilterBar tenants={tenants} value={filtroEmpresa} onChange={(v) => { setFiltroEmpresa(v); setModal({ mode: 'closed' }); }} />
      </div>

      {filtroEmpresa && (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-3 justify-between">
            <div className="flex flex-wrap gap-3 items-end">
              <label className="flex flex-col gap-1 text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Buscar por nombre
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej. rollo kraft…" className="h-9 w-56 border border-black/15 bg-white px-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel">
                Estado
                <select value={filtroActivo} onChange={(e) => setFiltroActivo(e.target.value as 'todos' | 'activos' | 'inactivos')} className="h-9 border border-black/15 bg-white px-2 text-sm min-w-[10rem]">
                  <option value="todos">Todos</option>
                  <option value="activos">Solo activos</option>
                  <option value="inactivos">Solo inactivos</option>
                </select>
              </label>
            </div>
            <button type="button" onClick={() => setModal({ mode: 'create' })} className="h-10 px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite">
              Nuevo producto
            </button>
          </div>

          {error && <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
          <p className="mt-2 text-xs text-vialto-steel">Filtro: {filtroLabel}{qDebounced ? ` · búsqueda: "${qDebounced}"` : ''}</p>

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
                  <tr><td colSpan={5} className="px-4 py-8 text-vialto-steel">Cargando…</td></tr>
                )}
                {rows?.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-vialto-steel">No hay productos que coincidan.</td></tr>
                )}
                {rows?.map((r) => (
                  <tr key={r.id} className="border-b border-black/5 hover:bg-vialto-mist/80">
                    <td className="px-4 py-3">
                      <div className="font-[family-name:var(--font-ui)] font-semibold tracking-wide">{r.nombre}</div>
                      {r.descripcion?.trim() ? <div className="mt-0.5 text-xs text-vialto-steel line-clamp-2">{r.descripcion}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-vialto-steel">{etiquetaUnidadProducto(r.unidadMedida)}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setModal({ mode: 'presentaciones', producto: r })} className="text-xs uppercase tracking-wider text-vialto-fire hover:underline">
                        Ver / gestionar
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={r.activo ? 'text-xs uppercase tracking-wider text-emerald-800' : 'text-xs uppercase tracking-wider text-vialto-steel'}>
                        {r.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button type="button" onClick={() => setModal({ mode: 'edit', producto: r })} className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist">Editar</button>
                      {r.activo ? (
                        <button type="button" onClick={() => void toggleActivo(r)} className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 text-red-900 hover:bg-red-50">Desactivar</button>
                      ) : (
                        <button type="button" onClick={() => void toggleActivo(r)} className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 text-emerald-900 hover:bg-emerald-50">Reactivar</button>
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
                <p className="text-sm text-vialto-steel">Página {meta.page} de {meta.totalPages} · {meta.total} registros</p>
                <label className="text-xs uppercase tracking-wider text-vialto-steel flex items-center gap-2">
                  Mostrar
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-8 border border-black/20 bg-white px-2 text-xs">
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </label>
              </div>
              <div className="inline-flex gap-2">
                <button type="button" disabled={!meta.hasPrev} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40">Anterior</button>
                <button type="button" disabled={!meta.hasNext} onClick={() => setPage((p) => p + 1)} className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40">Siguiente</button>
              </div>
            </div>
          )}
        </>
      )}

      {!filtroEmpresa && (
        <p className="mt-8 text-vialto-steel">Seleccioná una empresa para ver y gestionar su catálogo de productos.</p>
      )}

      {modal.mode === 'create' && filtroEmpresa && (
        <ProductoModal modo="create" tenantId={filtroEmpresa} getToken={getToken} onClose={() => setModal({ mode: 'closed' })} onSaved={async () => { setModal({ mode: 'closed' }); await load(); }} />
      )}
      {modal.mode === 'edit' && filtroEmpresa && (
        <ProductoModal modo="edit" productoInicial={modal.producto} tenantId={filtroEmpresa} getToken={getToken} onClose={() => setModal({ mode: 'closed' })} onSaved={async () => { setModal({ mode: 'closed' }); await load(); }} />
      )}
      {modal.mode === 'presentaciones' && filtroEmpresa && (
        <PresentacionesPanel producto={modal.producto} tenantId={filtroEmpresa} getToken={getToken} onClose={() => setModal({ mode: 'closed' })} />
      )}
    </div>
  );
}
