import { useAuth } from '@clerk/clerk-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  emptyFacturaDraft,
  FacturaEditModal,
  facturaToEditDraft,
  type FacturaDraft,
  ViajesCheckboxList,
} from '@/components/facturacion/FacturaEditModal';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson } from '@/lib/api';
import {
  textoImporteFacturaListado,
  textoImporteFacturaSeleccion,
  viajesFiltradosParaFactura,
} from '@/lib/viajesFlota';
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

const clienteInputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';

type FacturaNuevaNavState = {
  tenantId?: string;
  newFacturaDraft?: { clienteId: string; viajeIds: string[] };
};

// ─── componente principal ─────────────────────────────────────────────────────

export function FacturacionSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const tenants = useTenantsList();
  const [filtroEmpresa, setFiltroEmpresa] = useState('');

  const [facturas, setFacturas] = useState<Factura[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [empresaDataLoading, setEmpresaDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // crear
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<FacturaDraft>(emptyFacturaDraft());
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<FacturaDraft | null>(null);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // eliminar
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [facturaDeleteConfirm, setFacturaDeleteConfirm] = useState<Factura | null>(null);

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

  const facturaEdicionSnapshot = useMemo(
    () => (editingId && facturas ? facturas.find((r) => r.id === editingId) ?? null : null),
    [editingId, facturas],
  );

  useEffect(() => {
    if (!creating || !filtroEmpresa || viajes.length === 0) return;
    const allowed = new Set(viajesNuevaFactura.map((v) => v.id));
    setDraft((d) => {
      const next = d.viajeIds.filter((id) => allowed.has(id));
      if (next.length === d.viajeIds.length) return d;
      return { ...d, viajeIds: next };
    });
  }, [creating, filtroEmpresa, viajes.length, viajesNuevaFactura]);

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

  // ── carga al cambiar empresa ───────────────────────────────────────────────

  useEffect(() => {
    setFacturas(null);
    setClientes([]);
    setViajes([]);
    setError(null);
    setEditingId(null);
    setEditDraft(null);

    if (!filtroEmpresa || !isLoaded || !isSignedIn) {
      setEmpresaDataLoading(false);
      return;
    }
    let cancelled = false;
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    setEmpresaDataLoading(true);

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
      } finally {
        if (!cancelled) setEmpresaDataLoading(false);
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
    setDraft({ ...emptyFacturaDraft(), clienteId: clienteId ?? '', viajeIds: viajeIds ?? [] });
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
      setDraft(emptyFacturaDraft());
      await refetchFacturas();
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'No se pudo guardar la factura.');
    } finally {
      setSaving(false);
    }
  }

  // ── edición inline ─────────────────────────────────────────────────────────

  function startEdit(f: Factura) {
    setEditError(null);
    setEditingId(f.id);
    setEditDraft(facturaToEditDraft(f));
    setCreating(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
    setEditError(null);
  }

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

  async function confirmDeleteFactura() {
    const f = facturaDeleteConfirm;
    if (!f || deletingId || !filtroEmpresa) return;
    setDeletingId(f.id);
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    try {
      await apiJson(`/api/platform/facturas/${f.id}?${q}`, () => getToken(), { method: 'DELETE' });
      setFacturas((prev) => prev?.filter((r) => r.id !== f.id) ?? prev);
      if (editingId === f.id) cancelEdit();
      setFacturaDeleteConfirm(null);
    } catch {
      /* silencioso */
    } finally {
      setDeletingId(null);
    }
  }

  // ── lookups ────────────────────────────────────────────────────────────────

  function nombreCliente(id: string | null) {
    if (!id) return '—';
    return clientes.find((c) => c.id === id)?.nombre ?? id;
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const COL_SPAN = 8;

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">
        Facturación
      </h1>
      <p className="mt-2 text-vialto-steel">
        Vista de plataforma — seleccioná una empresa para ver sus facturas.
      </p>

      <div className="mt-6 space-y-2">
        {!editingId && filtroEmpresa && error && <CrudFormErrorAlert message={error} />}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[260px]">
            <EmpresaFilterBar
              tenants={tenants}
              value={filtroEmpresa}
              onChange={(v) => {
                setFiltroEmpresa(v);
                setCreating(false);
                setDraft(emptyFacturaDraft());
                cancelEdit();
              }}
            />
          </div>
          {filtroEmpresa && (
            <button
              type="button"
              disabled={!!editingId}
              onClick={() => {
                setCreating((v) => !v);
                setDraft(emptyFacturaDraft());
                setDraftError(null);
              }}
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-50 disabled:pointer-events-none"
            >
              {creating ? 'Cancelar' : 'Nueva factura'}
            </button>
          )}
        </div>
      </div>

      {/* sin empresa seleccionada */}
      {!filtroEmpresa && (
        <p className="mt-10 text-vialto-steel text-sm">
          Seleccioná una empresa para ver sus facturas.
        </p>
      )}

      {/* formulario de creación */}
      {creating && filtroEmpresa && !editingId && (
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
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Importe calculado</label>
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
              loading={empresaDataLoading}
            />
          </div>

          <div className="col-span-full space-y-2 pt-1">
            <CrudFormErrorAlert message={draftError} />
            <div className="flex gap-3">
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
          </div>
        </form>
      )}

      {/* tabla */}
      {filtroEmpresa && (
        <div className="mt-6 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire">
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Emisión</th>
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Importe</th>
                <th className="px-4 py-3 text-right">Acciones</th>
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

              {facturas?.map((f) => (
                  <Fragment key={f.id}>
                    <tr className="border-b border-black/5 hover:bg-vialto-mist/40">
                      <td className="px-4 py-3 font-medium">{f.numero}</td>
                      <td className="px-4 py-3">{TIPO_LABEL[f.tipo] ?? f.tipo}</td>
                      <td className="px-4 py-3 min-w-[12rem]">{nombreCliente(f.clienteId)}</td>
                      <td className="px-4 py-3 text-vialto-steel tabular-nums whitespace-nowrap">
                        {fmtFecha(f.fechaEmision)}
                      </td>
                      <td className="px-4 py-3 text-vialto-steel tabular-nums whitespace-nowrap">
                        {fmtFecha(f.fechaVencimiento)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={['border rounded px-2 py-0.5 text-xs font-medium', ESTADO_BADGE[f.estado] ?? ''].join(' ')}>
                          {ESTADO_LABEL[f.estado] ?? f.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium whitespace-normal">
                        {textoImporteFacturaListado(f, viajes)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => startEdit(f)}
                            className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === f.id}
                            onClick={() => setFacturaDeleteConfirm(f)}
                            className="text-xs uppercase tracking-wider px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                          >
                            {deletingId === f.id ? '…' : 'Eliminar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {filtroEmpresa && facturas && facturas.length > 0 && (
        <p className="mt-3 text-xs text-vialto-steel">
          {facturas.length} factura{facturas.length !== 1 ? 's' : ''}
        </p>
      )}

      {editingId && editDraft && facturaEdicionSnapshot && filtroEmpresa && (
        <FacturaEditModal
          open
          draft={editDraft}
          setDraft={setEditDraft}
          snapshotFactura={facturaEdicionSnapshot}
          clientes={clientes}
          viajes={viajes}
          viajesEdicion={viajesEdicionFactura}
          viajesLoading={empresaDataLoading}
          onClose={cancelEdit}
          onSave={() => void saveEdit()}
          saving={savingEditId === editingId}
          error={editError}
        />
      )}

      <ConfirmDialog
        open={facturaDeleteConfirm != null}
        title="Eliminar factura"
        message={
          facturaDeleteConfirm
            ? `¿Eliminás la factura ${facturaDeleteConfirm.numero}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        tone="danger"
        busy={!!deletingId && facturaDeleteConfirm != null && deletingId === facturaDeleteConfirm.id}
        onCancel={() => {
          if (!deletingId) setFacturaDeleteConfirm(null);
        }}
        onConfirm={() => void confirmDeleteFactura()}
      />
    </div>
  );
}
