import { useAuth } from '@clerk/clerk-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  emptyFacturaDraft,
  FacturaCreateModal,
  FacturaEditModal,
  facturaToEditDraft,
  type FacturaDraft,
} from '@/components/facturacion/FacturaEditModal';
import { FacturaAccionesMenu } from '@/components/facturacion/FacturaAccionesMenu';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import {
  monedaUnicaDeViajes,
  textoImporteFacturaListado,
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

type FacturaNuevaNavState = {
  newFacturaDraft?: { clienteId: string; viajeIds: string[] };
  expandFacturaId?: string;
};

// ─── componente principal ─────────────────────────────────────────────────────

export function FacturacionTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clientes } = useMaestroData();

  const [facturas, setFacturas] = useState<Factura[] | null>(null);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [viajesLoading, setViajesLoading] = useState(false);
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

  /** Abrir factura desde enlace (p. ej. alertas): `?factura=id` */
  useEffect(() => {
    const id = searchParams.get('factura')?.trim();
    if (!id || facturas === null) return;
    const f = facturas.find((x) => x.id === id);
    if (!f) {
      setSearchParams(
        (p) => {
          const next = new URLSearchParams(p);
          next.delete('factura');
          return next;
        },
        { replace: true },
      );
      return;
    }
    startEdit(f);
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.delete('factura');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, facturas, setSearchParams]);

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
    setDraft({ ...emptyFacturaDraft(), clienteId: clienteId ?? '', viajeIds: viajeIds ?? [] });
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

  async function handleCreate() {
    setDraftError(null);
    if (!draft.numero.trim()) { setDraftError('Ingresá el número de factura.'); return; }
    if (!draft.fechaEmision) { setDraftError('Ingresá la fecha de emisión.'); return; }
    if (monedaUnicaDeViajes(draft.viajeIds, viajes) === null) {
      setDraftError('Una factura no puede contener viajes en distintas monedas. Generá una factura por moneda.');
      return;
    }
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
    void ensureViajesLoaded();
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editingId || !editDraft) return;
    setEditError(null);
    if (!editDraft.numero.trim()) { setEditError('Ingresá el número de factura.'); return; }
    if (!editDraft.fechaEmision) { setEditError('Ingresá la fecha de emisión.'); return; }
    if (monedaUnicaDeViajes(editDraft.viajeIds, viajes) === null) {
      setEditError('Una factura no puede contener viajes en distintas monedas. Generá una factura por moneda.');
      return;
    }
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

  async function confirmDeleteFactura() {
    const f = facturaDeleteConfirm;
    if (!f || deletingId) return;
    setDeletingId(f.id);
    try {
      await apiJson(`/api/facturacion/facturas/${f.id}`, () => getToken(), { method: 'DELETE' });
      setFacturas((prev) => prev?.filter((r) => r.id !== f.id) ?? prev);
      if (editingId === f.id) cancelEdit();
      setFacturaDeleteConfirm(null);
    } catch {
      /* sin toaster */
    } finally {
      setDeletingId(null);
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  function nombreCliente(id: string | null) {
    if (!id) return '—';
    return clientes.find((c) => c.id === id)?.nombre ?? id;
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const COL_SPAN = 8;

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">Facturación</h1>
      <p className="mt-2 text-vialto-steel">Facturas emitidas a clientes y de transportistas externos.</p>

      {/* acciones */}
      <div className="mt-4">
        {error && <CrudFormErrorAlert message={error} />}
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={() => {
              setDraft(emptyFacturaDraft());
              setDraftError(null);
              void ensureViajesLoaded();
              setCreating(true);
            }}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Nueva factura
          </button>
        </div>
      </div>

      {/* tabla */}
      <div className="mt-6 rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full table-fixed text-left text-base">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
            <col className="w-[12%]" />
          </colgroup>
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
              <tr><td colSpan={COL_SPAN} className="px-4 py-8 text-vialto-steel">Cargando…</td></tr>
            )}
            {facturas?.length === 0 && (
              <tr><td colSpan={COL_SPAN} className="px-4 py-8 text-vialto-steel">
                Todavía no hay facturas registradas. Hacé clic en "Nueva factura" para empezar.
              </td></tr>
            )}

            {facturas?.map((f) => (
                <Fragment key={f.id}>
                  <tr className="border-b border-black/5 hover:bg-vialto-mist/40">
                    <td className="px-4 py-3 font-medium break-all">{f.numero}</td>
                    <td className="px-4 py-3 leading-snug">{TIPO_LABEL[f.tipo] ?? f.tipo}</td>
                    <td className="px-4 py-3 truncate" title={nombreCliente(f.clienteId)}>{nombreCliente(f.clienteId)}</td>
                    <td className="px-4 py-3 text-vialto-steel tabular-nums whitespace-nowrap">
                      {fmtFecha(f.fechaEmision)}
                    </td>
                    <td className="px-4 py-3 text-vialto-steel tabular-nums whitespace-nowrap">
                      {fmtFecha(f.fechaVencimiento)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={['border rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap', ESTADO_BADGE[f.estado] ?? ''].join(' ')}>
                        {ESTADO_LABEL[f.estado] ?? f.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap">
                      {textoImporteFacturaListado(f, viajes)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <FacturaAccionesMenu
                        factura={f}
                        deleting={deletingId === f.id}
                        onEditar={() => startEdit(f)}
                        onEliminar={() => setFacturaDeleteConfirm(f)}
                      />
                    </td>
                  </tr>
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>

      {facturas && facturas.length > 0 && (
        <p className="mt-3 text-xs text-vialto-steel">{facturas.length} factura{facturas.length !== 1 ? 's' : ''}</p>
      )}

      <FacturaCreateModal
        open={creating}
        draft={draft}
        setDraft={setDraft}
        clientes={clientes}
        viajes={viajes}
        viajesNueva={viajesNuevaFactura}
        viajesLoading={viajesLoading}
        onClose={() => { setCreating(false); setDraftError(null); }}
        onSave={() => void handleCreate()}
        saving={saving}
        error={draftError}
      />

      {editingId && editDraft && facturaEdicionSnapshot && (
        <FacturaEditModal
          open
          draft={editDraft}
          setDraft={setEditDraft}
          snapshotFactura={facturaEdicionSnapshot}
          clientes={clientes}
          viajes={viajes}
          viajesEdicion={viajesEdicionFactura}
          viajesLoading={viajesLoading}
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
