import { useAuth } from '@clerk/clerk-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import {
  textoImporteFacturaListado,
  textoImporteFacturaSeleccion,
  textoMontoFacturarListado,
  viajesFiltradosParaFactura,
} from '@/lib/viajesFlota';
import type { Factura, Viaje } from '@/types/api';

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
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isoToDate(iso: string | null | undefined) {
  if (!iso) return '';
  return iso.slice(0, 10);
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

function emptyDraft(): FacturaDraft {
  return { numero: '', tipo: 'cliente', clienteId: '', viajeIds: [], fechaEmision: todayIso(), fechaVencimiento: '' };
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

type FacturaNuevaNavState = {
  newFacturaDraft?: { clienteId: string; viajeIds: string[] };
  expandFacturaId?: string;
};

const clienteInputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';

// ─── sub-componente: selector multi-viaje ────────────────────────────────────

function ViajesCheckboxList({
  viajes,
  selected,
  onChange,
  loading,
}: {
  viajes: Viaje[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Mientras se obtiene el listado de viajes desde el servidor. */
  loading?: boolean;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  if (loading) {
    return <p className="text-sm text-vialto-steel py-1">Cargando…</p>;
  }

  if (viajes.length === 0) {
    return <p className="text-sm text-vialto-steel py-1">No hay viajes disponibles.</p>;
  }

  return (
    <div className="max-h-40 overflow-y-auto border border-black/15 rounded bg-white divide-y divide-black/5">
      {viajes.map((v) => (
        <label key={v.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-vialto-mist/60 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(v.id)}
            onChange={() => toggle(v.id)}
            className="accent-vialto-charcoal"
          />
          <span className="font-medium">{v.numero}</span>
          {(v.origen || v.destino) && (
            <span className="text-vialto-steel text-xs">{v.origen ?? '?'} → {v.destino ?? '?'}</span>
          )}
          {v.monto != null && (
            <span className="ml-auto text-xs tabular-nums text-vialto-steel">
              {textoMontoFacturarListado(v)}
            </span>
          )}
        </label>
      ))}
    </div>
  );
}

// ─── componente principal ─────────────────────────────────────────────────────

export function FacturacionTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const { clientes } = useMaestroData();

  const [facturas, setFacturas] = useState<Factura[] | null>(null);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [viajesLoading, setViajesLoading] = useState(false);
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

  const viajesNuevaFactura = useMemo(
    () => viajesFiltradosParaFactura(viajes, draft.tipo, draft.clienteId),
    [viajes, draft.tipo, draft.clienteId],
  );

  const viajesEdicionFactura = useMemo(() => {
    if (!editDraft || !editingId) return [];
    return viajesFiltradosParaFactura(viajes, editDraft.tipo, editDraft.clienteId, {
      facturaEdicionId: editingId,
      viajeIdsFacturaEdicion: editDraft.viajeIds,
    });
  }, [viajes, editDraft, editingId]);

  /** Si cambia cliente/tipo, sacar de la selección viajes que ya no aplican. */
  useEffect(() => {
    if (!creating || viajes.length === 0) return;
    const allowed = new Set(viajesNuevaFactura.map((v) => v.id));
    setDraft((d) => {
      const next = d.viajeIds.filter((id) => allowed.has(id));
      if (next.length === d.viajeIds.length) return d;
      return { ...d, viajeIds: next };
    });
  }, [creating, viajes.length, viajesNuevaFactura]);

  useEffect(() => {
    if (!editingId || !editDraft || viajes.length === 0) return;
    const allowed = new Set(viajesEdicionFactura.map((v) => v.id));
    setEditDraft((ed) => {
      if (!ed) return ed;
      const next = ed.viajeIds.filter((id) => allowed.has(id));
      if (next.length === ed.viajeIds.length) return ed;
      return { ...ed, viajeIds: next };
    });
  }, [editingId, editDraft?.clienteId, editDraft?.tipo, viajes.length, viajesEdicionFactura]);

  // ── carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const facturasData = await apiJson<Factura[]>('/api/facturacion/facturas', () => getToken());
        if (!cancelled) {
          setFacturas(facturasData);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'facturacion'));
      }
    })();
    return () => { cancelled = true; };
  }, [getToken, isLoaded, isSignedIn]);

  async function ensureViajesLoaded() {
    if (viajes.length > 0 || viajesLoading) return;
    setViajesLoading(true);
    try {
      const data = await apiJson<Viaje[]>('/api/viajes', () => getToken());
      setViajes(data);
    } catch { /* silencioso — el form mostrará lista vacía */ }
    finally { setViajesLoading(false); }
  }

  // ── pre-fill desde navegación ──────────────────────────────────────────────

  useEffect(() => {
    const state = location.state as FacturaNuevaNavState | null;
    if (!state) return;
    if (state.expandFacturaId) { window.history.replaceState({}, ''); return; }
    if (!state.newFacturaDraft) return;
    const { clienteId, viajeIds } = state.newFacturaDraft;
    setDraft({ ...emptyDraft(), clienteId: clienteId ?? '', viajeIds: viajeIds ?? [] });
    setCreating(true);
    void ensureViajesLoaded();
    window.history.replaceState({}, '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── refetch ────────────────────────────────────────────────────────────────

  async function refetchFacturas() {
    const gen = ++fetchRef.current;
    try {
      const data = await apiJson<Factura[]>('/api/facturacion/facturas', () => getToken());
      if (gen === fetchRef.current) setFacturas(data);
    } catch { /* silencioso */ }
  }

  // ── crear ──────────────────────────────────────────────────────────────────

  function setD(patch: Partial<FacturaDraft>) { setDraft((p) => ({ ...p, ...patch })); }

  async function handleCreate(e: { preventDefault(): void }) {
    e.preventDefault();
    setDraftError(null);
    if (!draft.numero.trim()) { setDraftError('Ingresá el número de factura.'); return; }
    if (!draft.fechaEmision) { setDraftError('Ingresá la fecha de emisión.'); return; }
    setSaving(true);
    try {
      await apiJson<Factura>('/api/facturacion/facturas', () => getToken(), {
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
    void ensureViajesLoaded();
  }

  function cancelEdit() { setEditingId(null); setEditDraft(null); setEditError(null); }

  function setE(patch: Partial<FacturaDraft>) { setEditDraft((p) => p ? { ...p, ...patch } : p); }

  async function saveEdit() {
    if (!editingId || !editDraft) return;
    setEditError(null);
    if (!editDraft.numero.trim()) { setEditError('Ingresá el número de factura.'); return; }
    if (!editDraft.fechaEmision) { setEditError('Ingresá la fecha de emisión.'); return; }
    setSavingEditId(editingId);
    try {
      const updated = await apiJson<Factura>(
        `/api/facturacion/facturas/${encodeURIComponent(editingId)}`,
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
    try {
      await apiJson(`/api/facturacion/facturas/${f.id}`, () => getToken(), { method: 'DELETE' });
      setFacturas((prev) => prev?.filter((r) => r.id !== f.id) ?? prev);
      if (editingId === f.id) cancelEdit();
    } catch { /* sin toaster */ } finally { setDeletingId(null); }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  function nombreCliente(id: string | null) {
    if (!id) return '—';
    return clientes.find((c) => c.id === id)?.nombre ?? id;
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const isEditing = !!editingId;
  const COL_SPAN = isEditing ? 7 : 8;

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">Facturación</h1>
      <p className="mt-2 text-vialto-steel">Facturas emitidas a clientes y de transportistas externos.</p>

      {/* acciones */}
      <div className="mt-4 space-y-2">
        {isEditing && <CrudFormErrorAlert message={editError} />}
        {!isEditing && error && <CrudFormErrorAlert message={error} />}
        <div className="flex justify-end gap-2">
          {isEditing ? (
            <>
              <button type="button" onClick={cancelEdit} disabled={savingEditId === editingId}
                className="inline-flex h-10 items-center px-4 border border-black/20 bg-white text-vialto-charcoal text-sm uppercase tracking-wider hover:bg-vialto-mist disabled:opacity-60">
                Cerrar
              </button>
              <button type="button" onClick={saveEdit} disabled={savingEditId === editingId}
                className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-60">
                {savingEditId === editingId ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </>
          ) : (
            <button type="button"
              onClick={() => { setCreating((v) => { if (!v) void ensureViajesLoaded(); return !v; }); setDraft(emptyDraft()); setDraftError(null); }}
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite">
              {creating ? 'Cancelar' : 'Nueva factura'}
            </button>
          )}
        </div>
      </div>

      {/* formulario de creación */}
      {creating && !isEditing && (
        <form onSubmit={handleCreate}
          className="mt-4 bg-white border border-black/10 rounded shadow-sm p-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <h2 className="col-span-full font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.2em] text-vialto-fire">
            Nueva factura
          </h2>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Número *</label>
            <input type="text" value={draft.numero} onChange={(e) => setD({ numero: e.target.value })}
              placeholder="0001-00000001" className="h-9 border border-black/20 px-3 text-sm bg-white" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Tipo *</label>
            <select value={draft.tipo} onChange={(e) => setD({ tipo: e.target.value as FacturaDraft['tipo'] })}
              className="h-9 border border-black/20 px-3 text-sm bg-white">
              <option value="cliente">Factura a cliente</option>
              <option value="transportista_externo">Factura de transportista externo</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Cliente</label>
            <ClienteSearchSelect
              clientes={clientes}
              value={draft.clienteId}
              onChange={(id) => setD({ clienteId: id })}
              inputClassName={clienteInputClass}
              allowEmptyValue
              emptyListChoiceLabel="— Sin cliente —"
              placeholderCerrado="— Sin cliente —"
              aria-label="Cliente"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Fecha de emisión *</label>
            <input type="date" value={draft.fechaEmision} onChange={(e) => setD({ fechaEmision: e.target.value })}
              className="h-9 border border-black/20 px-3 text-sm bg-white" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Fecha de vencimiento</label>
            <input type="date" value={draft.fechaVencimiento} onChange={(e) => setD({ fechaVencimiento: e.target.value })}
              className="h-9 border border-black/20 px-3 text-sm bg-white" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">
              Importe calculado
            </label>
            <p className="min-h-9 flex flex-wrap items-center text-sm font-medium tabular-nums px-1 gap-x-2">
              {textoImporteFacturaSeleccion(draft.viajeIds, viajes)}
            </p>
            <p className="text-[10px] text-vialto-steel">
              Suma de los montos de los viajes (ARS y USD por separado).
            </p>
          </div>

          <div className="col-span-full flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">
              Viajes vinculados {draft.viajeIds.length > 0 && `(${draft.viajeIds.length})`}
            </label>
            {draft.tipo === 'cliente' && !draft.clienteId.trim() && (
              <p className="text-[11px] text-vialto-steel -mt-0.5 mb-1">
                Elegí un cliente arriba para listar solo sus viajes.
              </p>
            )}
            <ViajesCheckboxList
              viajes={viajesNuevaFactura}
              selected={draft.viajeIds}
              onChange={(ids) => setD({ viajeIds: ids })}
              loading={viajesLoading}
            />
          </div>

          <div className="col-span-full space-y-2 pt-1">
            <CrudFormErrorAlert message={draftError} />
            <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="h-9 px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => { setCreating(false); setDraftError(null); }}
              className="h-9 px-4 border border-black/20 text-sm uppercase tracking-wider hover:bg-vialto-mist">
              Cancelar
            </button>
            </div>
          </div>
        </form>
      )}

      {/* tabla */}
      <div className="mt-6 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Emisión</th>
              <th className="px-4 py-3">Vencimiento</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Importe</th>
              {!isEditing && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {facturas === null && !error && (
              <tr><td colSpan={COL_SPAN} className="px-4 py-8 text-vialto-steel">Cargando…</td></tr>
            )}
            {facturas?.length === 0 && (
              <tr><td colSpan={COL_SPAN} className="px-4 py-8 text-vialto-steel">
                Todavía no hay facturas registradas. Hacé clic en "Nueva factura" para empezar.
              </td></tr>
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
                    <td className="px-4 py-3 min-w-[12rem]">
                      {editing && ed
                        ? (
                            <ClienteSearchSelect
                              clientes={clientes}
                              value={ed.clienteId}
                              onChange={(id) => setE({ clienteId: id })}
                              inputClassName={clienteInputClass}
                              allowEmptyValue
                              emptyListChoiceLabel="— Sin cliente —"
                              placeholderCerrado="— Sin cliente —"
                              aria-label="Cliente"
                            />
                          )
                        : nombreCliente(f.clienteId)}
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

                    {/* Estado (solo lectura) */}
                    <td className="px-4 py-3">
                      <span className={['border rounded px-2 py-0.5 text-xs font-medium', ESTADO_BADGE[f.estado] ?? ''].join(' ')}>
                        {ESTADO_LABEL[f.estado] ?? f.estado}
                      </span>
                    </td>

                    {/* Importe (siempre solo lectura — calculado desde viajes) */}
                    <td className="px-4 py-3 text-right tabular-nums font-medium whitespace-normal">
                      {editing && ed
                        ? textoImporteFacturaSeleccion(ed.viajeIds, viajes)
                        : textoImporteFacturaListado(f, viajes)}
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
                  {editing && ed && (
                    <tr className="border-b border-black/5 bg-vialto-mist/40">
                      <td colSpan={7} className="px-4 py-3 text-vialto-steel">
                        <p className="text-[11px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-fire mb-2">
                          Viajes vinculados
                        </p>
                        {ed.tipo === 'cliente' && !ed.clienteId.trim() && (
                          <p className="text-[11px] text-vialto-steel mb-1">
                            Elegí un cliente para listar solo sus viajes.
                          </p>
                        )}
                        <div className="max-w-xl">
                          <ViajesCheckboxList
                            viajes={viajesEdicionFactura}
                            selected={ed.viajeIds}
                            onChange={(ids) => setE({ viajeIds: ids })}
                            loading={viajesLoading}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {facturas && facturas.length > 0 && (
        <p className="mt-3 text-xs text-vialto-steel">{facturas.length} factura{facturas.length !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}
