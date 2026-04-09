import { useAuth } from '@clerk/clerk-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson } from '@/lib/api';
import type { Cliente, Factura, Viaje } from '@/types/api';

// ─── helpers ────────────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'PENDIENTE',
  cobrada: 'COBRADA',
  vencida: 'VENCIDA',
};

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-950 border-amber-300/90',
  cobrada: 'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  vencida: 'bg-red-100 text-red-950 border-red-400/80',
};

const TIPO_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  transportista_externo: 'Transportista externo',
};

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtMonto(n: number | null) {
  if (n == null) return '—';
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoToDate(iso: string | null | undefined) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function computeImporteLocal(viajeIds: string[], viajes: Viaje[]) {
  return viajeIds.reduce((sum, id) => {
    const v = viajes.find((x) => x.id === id);
    return sum + (v?.monto ?? 0);
  }, 0);
}

// ─── tipos internos ──────────────────────────────────────────────────────────

type FacturaDraft = {
  numero: string;
  tipo: 'cliente' | 'transportista_externo';
  clienteId: string;
  viajeIds: string[];
  fechaEmision: string;
  fechaVencimiento: string;
};

type FacturaNuevaNavState = {
  tenantId?: string;
  newFacturaDraft?: { clienteId: string; viajeIds: string[] };
};

function emptyDraft(): FacturaDraft {
  return {
    numero: '',
    tipo: 'cliente',
    clienteId: '',
    viajeIds: [],
    fechaEmision: todayIso(),
    fechaVencimiento: '',
  };
}

function facturaToEditDraft(f: Factura): FacturaDraft {
  return {
    numero: f.numero,
    tipo: f.tipo,
    clienteId: f.clienteId ?? '',
    viajeIds: f.viajeIds,
    fechaEmision: isoToDate(f.fechaEmision),
    fechaVencimiento: isoToDate(f.fechaVencimiento),
  };
}

// ─── sub-componente: selector multi-viaje ─────────────────────────────────────

function ViajesCheckboxList({
  viajes,
  selected,
  onChange,
}: {
  viajes: Viaje[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  if (viajes.length === 0) {
    return <p className="text-sm text-vialto-steel py-1">No hay viajes disponibles.</p>;
  }

  return (
    <div className="max-h-40 overflow-y-auto border border-black/15 rounded bg-white divide-y divide-black/5">
      {viajes.map((v) => (
        <label
          key={v.id}
          className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-vialto-mist/60 text-sm"
        >
          <input
            type="checkbox"
            checked={selected.includes(v.id)}
            onChange={() => toggle(v.id)}
            className="accent-vialto-charcoal"
          />
          <span className="font-medium">{v.numero}</span>
          {(v.origen || v.destino) && (
            <span className="text-vialto-steel text-xs">
              {v.origen ?? '?'} → {v.destino ?? '?'}
            </span>
          )}
          {v.monto != null && (
            <span className="ml-auto text-xs tabular-nums text-vialto-steel">{fmtMonto(v.monto)}</span>
          )}
        </label>
      ))}
    </div>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────

export function FacturacionSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const tenants = useTenantsList();
  const [filtroEmpresa, setFiltroEmpresa] = useState('');

  const [facturas, setFacturas] = useState<Factura[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [error, setError] = useState<string | null>(null);

  // crear
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<FacturaDraft>(emptyDraft());
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<FacturaDraft | null>(null);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // eliminar
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRef = useRef(0);

  // ── carga al cambiar empresa ───────────────────────────────────────────────

  useEffect(() => {
    setFacturas(null);
    setClientes([]);
    setViajes([]);
    setError(null);
    setEditingId(null);
    setEditDraft(null);

    if (!filtroEmpresa || !isLoaded || !isSignedIn) return;
    let cancelled = false;
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;

    (async () => {
      try {
        const [facturasData, clientesData, viajesData] = await Promise.all([
          apiJson<Factura[]>(`/api/platform/facturas?${q}`, () => getToken()),
          apiJson<Cliente[]>(`/api/platform/clientes?${q}`, () => getToken()),
          apiJson<Viaje[]>(`/api/platform/viajes?${q}`, () => getToken()),
        ]);
        if (!cancelled) {
          setFacturas(facturasData);
          setClientes(clientesData);
          setViajes(viajesData);
          setError(null);
        }
      } catch {
        if (!cancelled)
          setError('No pudimos cargar las facturas de esta empresa. Probá de nuevo.');
      }
    })();

    return () => { cancelled = true; };
  }, [filtroEmpresa, getToken, isLoaded, isSignedIn]);

  // ── pre-fill desde navegación ──────────────────────────────────────────────

  useEffect(() => {
    const state = location.state as FacturaNuevaNavState | null;
    if (!state?.newFacturaDraft) return;
    const { clienteId, viajeIds } = state.newFacturaDraft;
    if (state.tenantId) setFiltroEmpresa(state.tenantId);
    setDraft({ ...emptyDraft(), clienteId: clienteId ?? '', viajeIds: viajeIds ?? [] });
    setCreating(true);
    window.history.replaceState({}, '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── refetch ────────────────────────────────────────────────────────────────

  async function refetchFacturas() {
    if (!filtroEmpresa) return;
    const gen = ++fetchRef.current;
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    try {
      const data = await apiJson<Factura[]>(`/api/platform/facturas?${q}`, () => getToken());
      if (gen === fetchRef.current) setFacturas(data);
    } catch { /* silencioso */ }
  }

  // ── crear ──────────────────────────────────────────────────────────────────

  function setD(patch: Partial<FacturaDraft>) { setDraft((p) => ({ ...p, ...patch })); }

  async function handleCreate(e: { preventDefault(): void }) {
    e.preventDefault();
    setDraftError(null);
    if (!filtroEmpresa) { setDraftError('Seleccioná una empresa.'); return; }
    if (!draft.numero.trim()) { setDraftError('Ingresá el número de factura.'); return; }
    if (!draft.fechaEmision) { setDraftError('Ingresá la fecha de emisión.'); return; }

    setSaving(true);
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    try {
      await apiJson<Factura>(`/api/platform/facturas?${q}`, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          numero: draft.numero.trim(),
          tipo: draft.tipo,
          clienteId: draft.clienteId || undefined,
          viajeIds: draft.viajeIds,
          fechaEmision: draft.fechaEmision,
          fechaVencimiento: draft.fechaVencimiento || undefined,
        }),
      });
      setCreating(false);
      setDraft(emptyDraft());
      await refetchFacturas();
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'No se pudo guardar la factura.');
    } finally {
      setSaving(false);
    }
  }

  // ── edición inline ─────────────────────────────────────────────────────────

  function startEdit(f: Factura) {
    setEditingId(f.id);
    setEditDraft(facturaToEditDraft(f));
    setEditError(null);
    setCreating(false);
  }

  function cancelEdit() { setEditingId(null); setEditDraft(null); setEditError(null); }

  function setE(patch: Partial<FacturaDraft>) { setEditDraft((p) => p ? { ...p, ...patch } : p); }

  async function saveEdit() {
    if (!editingId || !editDraft || !filtroEmpresa) return;
    setEditError(null);
    if (!editDraft.numero.trim()) { setEditError('Ingresá el número de factura.'); return; }
    if (!editDraft.fechaEmision) { setEditError('Ingresá la fecha de emisión.'); return; }
    setSavingEditId(editingId);
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    try {
      const updated = await apiJson<Factura>(
        `/api/platform/facturas/${encodeURIComponent(editingId)}?${q}`,
        () => getToken(),
        {
          method: 'PATCH',
          body: JSON.stringify({
            numero: editDraft.numero.trim(),
            tipo: editDraft.tipo,
            clienteId: editDraft.clienteId || undefined,
            viajeIds: editDraft.viajeIds,
            fechaEmision: editDraft.fechaEmision,
            fechaVencimiento: editDraft.fechaVencimiento || undefined,
          }),
        },
      );
      setFacturas((prev) => prev ? prev.map((r) => r.id === editingId ? updated : r) : prev);
      cancelEdit();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'No se pudo guardar la factura.');
    } finally {
      setSavingEditId(null);
    }
  }

  // ── eliminar ───────────────────────────────────────────────────────────────

  async function handleDelete(f: Factura) {
    if (!confirm(`¿Eliminás la factura ${f.numero}? Esta acción no se puede deshacer.`)) return;
    setDeletingId(f.id);
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    try {
      await apiJson(`/api/platform/facturas/${f.id}?${q}`, () => getToken(), { method: 'DELETE' });
      setFacturas((prev) => prev?.filter((r) => r.id !== f.id) ?? prev);
      if (editingId === f.id) cancelEdit();
    } catch { /* silencioso */ } finally { setDeletingId(null); }
  }

  // ── lookups ────────────────────────────────────────────────────────────────

  function nombreCliente(id: string | null) {
    if (!id) return '—';
    return clientes.find((c) => c.id === id)?.nombre ?? id;
  }

  function numerosViaje(ids: string[]) {
    if (ids.length === 0) return '—';
    return ids.map((id) => viajes.find((v) => v.id === id)?.numero ?? id).join(', ');
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const isEditing = !!editingId;
  const COL_SPAN = isEditing ? 7 : 8;

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Facturación
      </h1>
      <p className="mt-2 text-vialto-steel">
        Vista de plataforma — seleccioná una empresa para ver sus facturas.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[260px]">
          <EmpresaFilterBar
            tenants={tenants}
            value={filtroEmpresa}
            onChange={(v) => {
              setFiltroEmpresa(v);
              setCreating(false);
              setDraft(emptyDraft());
            }}
          />
        </div>
        {filtroEmpresa && (
          isEditing ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={savingEditId === editingId}
                className="inline-flex h-10 items-center px-4 border border-black/20 bg-white text-vialto-charcoal text-sm uppercase tracking-wider hover:bg-vialto-mist disabled:opacity-60"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEditId === editingId}
                className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-60"
              >
                {savingEditId === editingId ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCreating((v) => !v);
                setDraft(emptyDraft());
                setDraftError(null);
              }}
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
            >
              {creating ? 'Cancelar' : 'Nueva factura'}
            </button>
          )
        )}
      </div>

      {/* errores */}
      {error && filtroEmpresa && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {editError && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {editError}
        </p>
      )}

      {/* sin empresa seleccionada */}
      {!filtroEmpresa && (
        <p className="mt-10 text-vialto-steel text-sm">
          Seleccioná una empresa para ver sus facturas.
        </p>
      )}

      {/* formulario de creación */}
      {creating && filtroEmpresa && !isEditing && (
        <form
          onSubmit={handleCreate}
          className="mt-4 bg-white border border-black/10 rounded shadow-sm p-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <h2 className="col-span-full font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.2em] text-vialto-fire">
            Nueva factura
          </h2>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Número *</label>
            <input
              type="text"
              value={draft.numero}
              onChange={(e) => setD({ numero: e.target.value })}
              placeholder="0001-00000001"
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Tipo *</label>
            <select
              value={draft.tipo}
              onChange={(e) => setD({ tipo: e.target.value as FacturaDraft['tipo'] })}
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            >
              <option value="cliente">Factura a cliente</option>
              <option value="transportista_externo">Factura de transportista externo</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Cliente</label>
            <select
              value={draft.clienteId}
              onChange={(e) => setD({ clienteId: e.target.value })}
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            >
              <option value="">— Sin cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Fecha de emisión *</label>
            <input
              type="date"
              value={draft.fechaEmision}
              onChange={(e) => setD({ fechaEmision: e.target.value })}
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Fecha de vencimiento</label>
            <input
              type="date"
              value={draft.fechaVencimiento}
              onChange={(e) => setD({ fechaVencimiento: e.target.value })}
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Importe estimado</label>
            <p className="h-9 flex items-center text-sm font-medium tabular-nums px-1">
              {fmtMonto(computeImporteLocal(draft.viajeIds, viajes))}
            </p>
          </div>

          <div className="col-span-full flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">
              Viajes vinculados {draft.viajeIds.length > 0 && `(${draft.viajeIds.length})`}
            </label>
            <ViajesCheckboxList
              viajes={viajes}
              selected={draft.viajeIds}
              onChange={(ids) => setD({ viajeIds: ids })}
            />
          </div>

          {draftError && (
            <p className="col-span-full text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {draftError}
            </p>
          )}

          <div className="col-span-full flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="h-9 px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setDraftError(null); }}
              className="h-9 px-4 border border-black/20 text-sm uppercase tracking-wider hover:bg-vialto-mist"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* tabla */}
      {filtroEmpresa && (
        <div className="mt-6 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Viajes</th>
                <th className="px-4 py-3 text-right">Importe</th>
                <th className="px-4 py-3">Emisión</th>
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3">Estado</th>
                {!isEditing && <th className="px-4 py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {facturas === null && !error && (
                <tr>
                  <td colSpan={COL_SPAN} className="px-4 py-8 text-vialto-steel">Cargando…</td>
                </tr>
              )}
              {facturas?.length === 0 && (
                <tr>
                  <td colSpan={COL_SPAN} className="px-4 py-8 text-vialto-steel">
                    Esta empresa no tiene facturas registradas.
                  </td>
                </tr>
              )}

              {facturas?.map((f) => {
                const editing = editingId === f.id;
                const ed = editing ? editDraft : null;

                return (
                  <Fragment key={f.id}>
                    <tr className={['border-b border-black/5', editing ? 'bg-vialto-mist/60' : 'hover:bg-vialto-mist/40'].join(' ')}>

                      {/* Número */}
                      <td className="px-4 py-3 font-medium">
                        {editing && ed
                          ? <input type="text" value={ed.numero} onChange={(e) => setE({ numero: e.target.value })}
                              className="h-9 w-full border border-black/15 bg-white px-2 text-sm" />
                          : f.numero}
                      </td>

                      {/* Tipo */}
                      <td className="px-4 py-3">
                        {editing && ed
                          ? <select value={ed.tipo} onChange={(e) => setE({ tipo: e.target.value as FacturaDraft['tipo'] })}
                              className="h-9 w-full border border-black/15 bg-white px-2 text-sm">
                              <option value="cliente">Cliente</option>
                              <option value="transportista_externo">Transportista externo</option>
                            </select>
                          : (TIPO_LABEL[f.tipo] ?? f.tipo)}
                      </td>

                      {/* Cliente */}
                      <td className="px-4 py-3">
                        {editing && ed
                          ? <select value={ed.clienteId} onChange={(e) => setE({ clienteId: e.target.value })}
                              className="h-9 w-full border border-black/15 bg-white px-2 text-sm">
                              <option value="">— Sin cliente —</option>
                              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                          : nombreCliente(f.clienteId)}
                      </td>

                      {/* Viajes */}
                      <td className="px-4 py-3 text-vialto-steel">
                        {editing && ed
                          ? <div className="min-w-[16rem]">
                              <ViajesCheckboxList viajes={viajes} selected={ed.viajeIds}
                                onChange={(ids) => setE({ viajeIds: ids })} />
                            </div>
                          : numerosViaje(f.viajeIds)}
                      </td>

                      {/* Importe (solo lectura — calculado desde viajes) */}
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {editing && ed
                          ? fmtMonto(computeImporteLocal(ed.viajeIds, viajes))
                          : fmtMonto(f.importe)}
                      </td>

                      {/* Emisión */}
                      <td className="px-4 py-3 text-vialto-steel tabular-nums whitespace-nowrap">
                        {editing && ed
                          ? <input type="date" value={ed.fechaEmision} onChange={(e) => setE({ fechaEmision: e.target.value })}
                              className="h-9 border border-black/15 bg-white px-2 text-sm" />
                          : fmtFecha(f.fechaEmision)}
                      </td>

                      {/* Vencimiento */}
                      <td className="px-4 py-3 text-vialto-steel tabular-nums whitespace-nowrap">
                        {editing && ed
                          ? <input type="date" value={ed.fechaVencimiento} onChange={(e) => setE({ fechaVencimiento: e.target.value })}
                              className="h-9 border border-black/15 bg-white px-2 text-sm" />
                          : fmtFecha(f.fechaVencimiento)}
                      </td>

                      {/* Estado (solo lectura — computado desde viajes) */}
                      <td className="px-4 py-3">
                        <span className={['border rounded px-2 py-0.5 text-xs font-medium', ESTADO_BADGE[f.estado] ?? ''].join(' ')}>
                          {ESTADO_LABEL[f.estado] ?? f.estado}
                        </span>
                      </td>

                      {/* Acciones */}
                      {!isEditing && (
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2 justify-end">
                            <button type="button" onClick={() => startEdit(f)}
                              className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist">
                              Editar
                            </button>
                            <button type="button" disabled={deletingId === f.id} onClick={() => handleDelete(f)}
                              className="text-xs uppercase tracking-wider px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40">
                              {deletingId === f.id ? '…' : 'Eliminar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtroEmpresa && facturas && facturas.length > 0 && (
        <p className="mt-3 text-xs text-vialto-steel">
          {facturas.length} factura{facturas.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
