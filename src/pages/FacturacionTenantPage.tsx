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
import { FacturaViewModal } from '@/components/facturacion/FacturaViewModal';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import {
  monedaUnicaDeViajes,
  textoImporteFacturaListado,
  viajesFiltradosParaFactura,
} from '@/lib/viajesFlota';
import type { Cliente, Factura, Transportista, Viaje } from '@/types/api';

function facturaPayloadFromDraft(draft: FacturaDraft) {
  const base = {
    numero: draft.numero.trim(),
    tipo: draft.tipo,
    viajeIds: draft.viajeIds,
    fechaEmision: draft.fechaEmision,
    fechaVencimiento: draft.fechaVencimiento || undefined,
  };
  if (draft.tipo === 'transportista_externo') {
    return {
      ...base,
      transportistaId: draft.transportistaId || undefined,
      clienteId: undefined,
    };
  }
  return {
    ...base,
    clienteId: draft.clienteId || undefined,
    transportistaId: undefined,
  };
}

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
  tenantId?: string;
  newFacturaDraft?: { clienteId: string; viajeIds: string[] };
  expandFacturaId?: string;
  viewFacturaId?: string;
};

// ─── componente principal ─────────────────────────────────────────────────────

export function FacturacionTenantPage({
  tenantId,
  embeddedInSuperadmin,
}: {
  tenantId?: string;
  /** Cuando true, el padre (superadmin) ya muestra título y barra de empresa. */
  embeddedInSuperadmin?: boolean;
} = {}) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const maestro = useMaestroData();
  const platform = Boolean(tenantId?.trim());
  const tid = tenantId?.trim() ?? '';
  const [clientesPlatform, setClientesPlatform] = useState<Cliente[]>([]);
  const [transportistasPlatform, setTransportistasPlatform] = useState<Transportista[]>([]);
  const clientes = platform ? clientesPlatform : maestro.clientes;
  const transportistas = platform ? transportistasPlatform : maestro.transportistas;

  const facturasListUrl = useMemo(() => {
    if (!platform) return '/api/facturacion/facturas';
    return `/api/platform/facturas?tenantId=${encodeURIComponent(tid)}`;
  }, [platform, tid]);

  const viajesListUrl = useMemo(() => {
    if (!platform) return '/api/viajes';
    return `/api/platform/viajes?tenantId=${encodeURIComponent(tid)}`;
  }, [platform, tid]);

  function facturaUrl(id: string) {
    if (!platform) return `/api/facturacion/facturas/${encodeURIComponent(id)}`;
    return `/api/platform/facturas/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tid)}`;
  }

  function facturasCreateUrl() {
    if (!platform) return '/api/facturacion/facturas';
    return `/api/platform/facturas?tenantId=${encodeURIComponent(tid)}`;
  }

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
  const [viewingFactura, setViewingFactura] = useState<Factura | null>(null);

  // filtros de columna (client-side)
  const [numFiltro, setNumFiltro] = useState('');
  const [numFiltroInput, setNumFiltroInput] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [clienteIdFiltro, setClienteIdFiltro] = useState('');
  const [emisionDesdeFiltro, setEmisionDesdeFiltro] = useState('');
  const [emisionHastaFiltro, setEmisionHastaFiltro] = useState('');
  const [vencimientoDesdeFiltro, setVencimientoDesdeFiltro] = useState('');
  const [vencimientoHastaFiltro, setVencimientoHastaFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');

  const fetchRef = useRef(0);
  const expandFacturaHandledRef = useRef(false);
  const viewFacturaHandledRef = useRef(false);

  const viajesNuevaFactura = useMemo(
    () =>
      viajesFiltradosParaFactura(
        viajes,
        draft.tipo,
        draft.clienteId,
        draft.transportistaId,
      ),
    [viajes, draft.tipo, draft.clienteId, draft.transportistaId],
  );

  const viajesEdicionFactura = useMemo(() => {
    if (!editDraft || !editingId) return [];
    return viajesFiltradosParaFactura(
      viajes,
      editDraft.tipo,
      editDraft.clienteId,
      editDraft.transportistaId,
      {
        facturaEdicionId: editingId,
        viajeIdsFacturaEdicion: editDraft.viajeIds,
      },
    );
  }, [viajes, editDraft, editingId]);

  const facturaEdicionSnapshot = useMemo(
    () => (editingId && facturas ? facturas.find((r) => r.id === editingId) ?? null : null),
    [editingId, facturas],
  );

  useEffect(() => {
    if (!platform || !tid || !isLoaded || !isSignedIn) {
      setClientesPlatform([]);
      setTransportistasPlatform([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [c, t] = await Promise.all([
          apiJson<Cliente[]>(
            `/api/platform/clientes?tenantId=${encodeURIComponent(tid)}`,
            () => getToken(),
          ),
          apiJson<Transportista[]>(
            `/api/platform/transportistas?tenantId=${encodeURIComponent(tid)}`,
            () => getToken(),
          ),
        ]);
        if (!cancelled) {
          setClientesPlatform(c);
          setTransportistasPlatform(t);
        }
      } catch {
        if (!cancelled) {
          setClientesPlatform([]);
          setTransportistasPlatform([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platform, tid, isLoaded, isSignedIn, getToken]);

  const anyFiltroActivo =
    !!numFiltro.trim() ||
    !!tipoFiltro ||
    !!clienteIdFiltro ||
    !!emisionDesdeFiltro ||
    !!emisionHastaFiltro ||
    !!vencimientoDesdeFiltro ||
    !!vencimientoHastaFiltro ||
    !!estadoFiltro;

  const facturasFiltradas = useMemo(() => {
    if (!facturas) return null;
    return facturas.filter((f) => {
      if (numFiltro.trim() && !f.numero.toLowerCase().includes(numFiltro.trim().toLowerCase())) return false;
      if (tipoFiltro && f.tipo !== tipoFiltro) return false;
      if (clienteIdFiltro && f.clienteId !== clienteIdFiltro) return false;
      const emision = f.fechaEmision ? f.fechaEmision.substring(0, 10) : '';
      if (emisionDesdeFiltro && emision < emisionDesdeFiltro) return false;
      if (emisionHastaFiltro && emision > emisionHastaFiltro) return false;
      const vence = f.fechaVencimiento ? f.fechaVencimiento.substring(0, 10) : '';
      if (vencimientoDesdeFiltro && (!vence || vence < vencimientoDesdeFiltro)) return false;
      if (vencimientoHastaFiltro && (!vence || vence > vencimientoHastaFiltro)) return false;
      if (estadoFiltro && f.estado !== estadoFiltro) return false;
      return true;
    });
  }, [
    facturas,
    numFiltro,
    tipoFiltro,
    clienteIdFiltro,
    emisionDesdeFiltro,
    emisionHastaFiltro,
    vencimientoDesdeFiltro,
    vencimientoHastaFiltro,
    estadoFiltro,
  ]);

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
  }, [
    editingId,
    editDraft?.clienteId,
    editDraft?.transportistaId,
    editDraft?.tipo,
    viajes.length,
    viajesEdicionFactura,
  ]);

  // ── carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (platform && !tid) return;
    let cancelled = false;
    (async () => {
      try {
        const facturasData = await apiJson<Factura[]>(facturasListUrl, () => getToken());
        if (!cancelled) {
          setFacturas(facturasData);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, platform ? 'plataforma' : 'facturacion'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, facturasListUrl, platform, tid]);

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
    setViewingFactura(f);
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
      const data = await apiJson<Viaje[]>(viajesListUrl, () => getToken());
      setViajes(data);
    } catch { /* silencioso — el form mostrará lista vacía */ }
    finally { setViajesLoading(false); }
  }

  // ── pre-fill desde navegación ──────────────────────────────────────────────

  useEffect(() => {
    const state = location.state as FacturaNuevaNavState | null;
    if (!state) return;
    if (state.expandFacturaId?.trim()) return;
    if (!state.newFacturaDraft) return;
    const { clienteId, viajeIds } = state.newFacturaDraft;
    setDraft({ ...emptyFacturaDraft(), clienteId: clienteId ?? '', viajeIds: viajeIds ?? [] });
    setCreating(true);
    void ensureViajesLoaded();
    window.history.replaceState({}, '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const expand = (location.state as FacturaNuevaNavState | null)?.expandFacturaId?.trim();
    if (!expand || facturas === null || expandFacturaHandledRef.current) return;
    const f = facturas.find((x) => x.id === expand);
    if (!f) return;
    expandFacturaHandledRef.current = true;
    window.history.replaceState({}, '');
    startEdit(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facturas]);


  useEffect(() => {
    const viewId = (location.state as FacturaNuevaNavState | null)?.viewFacturaId?.trim();
    if (!viewId || facturas === null || viewFacturaHandledRef.current) return;
    const f = facturas.find((x) => x.id === viewId);
    if (!f) return;
    viewFacturaHandledRef.current = true;
    window.history.replaceState({}, '');
    setViewingFactura(f);
  }, [facturas]);

  // ── refetch ────────────────────────────────────────────────────────────────

  async function refetchFacturas() {
    const gen = ++fetchRef.current;
    try {
      const data = await apiJson<Factura[]>(facturasListUrl, () => getToken());
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
      await apiJson<Factura>(facturasCreateUrl(), () => getToken(), {
        method: 'POST',
        body: JSON.stringify(facturaPayloadFromDraft(draft)),
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
        facturaUrl(editingId),
        () => getToken(),
        {
          method: 'PATCH',
          body: JSON.stringify(facturaPayloadFromDraft(editDraft)),
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
      await apiJson(facturaUrl(f.id), () => getToken(), { method: 'DELETE' });
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

  function nombreCliente(id: string | null | undefined) {
    if (!id) return '—';
    return clientes.find((c) => c.id === id)?.nombre ?? id;
  }

  function nombreContraparte(f: Factura) {
    if (f.tipo === 'transportista_externo') {
      const id = f.transportistaId;
      if (!id) return '—';
      return transportistas.find((t) => t.id === id)?.nombre ?? id;
    }
    const id = f.clienteId;
    if (!id) return '—';
    return clientes.find((c) => c.id === id)?.nombre ?? id;
  }

  function limpiarFiltros() {
    setNumFiltro('');
    setNumFiltroInput('');
    setTipoFiltro('');
    setClienteIdFiltro('');
    setEmisionDesdeFiltro('');
    setEmisionHastaFiltro('');
    setVencimientoDesdeFiltro('');
    setVencimientoHastaFiltro('');
    setEstadoFiltro('');
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const COL_SPAN = 8;

  return (
    <div className="w-full">
      {!embeddedInSuperadmin && (
        <>
          <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide">Facturación</h1>
          <p className="mt-2 text-vialto-steel">Facturas emitidas a clientes y de transportistas externos.</p>
        </>
      )}

      {/* acciones */}
      <div className="mt-4">
        {error && <CrudFormErrorAlert message={error} />}
        <div className="flex justify-end gap-2 mt-2">
          {anyFiltroActivo && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
            >
              Limpiar filtros
            </button>
          )}
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
      <div className="mt-6 overflow-x-hidden rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full table-fixed text-left text-base">
          <colgroup>
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[17%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[13%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire">
              <th scope="col" className="px-4 py-3 align-top">
                <ViajesListadoHeaderFiltro
                  title="Número"
                  filterActive={!!numFiltro.trim()}
                  filterSignature={numFiltro}
                >
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={numFiltroInput}
                      onChange={(e) => setNumFiltroInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setNumFiltro(numFiltroInput); }}
                      placeholder="Buscar…"
                      className={`h-9 min-w-0 flex-1 border border-black/15 bg-white px-2 text-sm ${
                        numFiltro.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'
                      }`}
                      aria-label="Filtrar por número de factura"
                    />
                    <button
                      type="button"
                      onClick={() => setNumFiltro(numFiltroInput)}
                      className="h-9 shrink-0 border border-black/15 bg-white px-2 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                    >
                      OK
                    </button>
                  </div>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top">
                <ViajesListadoHeaderFiltro
                  title="Tipo"
                  filterActive={!!tipoFiltro}
                  filterSignature={tipoFiltro}
                >
                  <select
                    value={tipoFiltro}
                    onChange={(e) => setTipoFiltro(e.target.value)}
                    className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      tipoFiltro ? 'text-vialto-fire' : 'text-vialto-charcoal'
                    }`}
                    aria-label="Filtrar por tipo de factura"
                  >
                    <option value="">Todos</option>
                    <option value="cliente">Cliente</option>
                    <option value="transportista_externo">Transportista externo</option>
                  </select>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top">
                <ViajesListadoHeaderFiltro
                  title="Cliente"
                  filterActive={!!clienteIdFiltro}
                  filterSignature={clienteIdFiltro}
                >
                  <ClienteSearchSelect
                    id="facturas-col-filtro-cliente"
                    clientes={clientes}
                    value={clienteIdFiltro}
                    onChange={(id) => setClienteIdFiltro(id)}
                    allowEmptyValue
                    emptyListChoiceLabel="Todos"
                    placeholderCerrado="Todos"
                    aria-label="Filtrar por cliente"
                    inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      clienteIdFiltro ? 'text-vialto-fire' : 'text-vialto-charcoal'
                    }`}
                  />
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top">
                <ViajesListadoHeaderFiltro
                  title="Emisión"
                  filterActive={!!emisionDesdeFiltro || !!emisionHastaFiltro}
                  filterSignature={`${emisionDesdeFiltro}|${emisionHastaFiltro}`}
                >
                  <div className="flex flex-col gap-1.5">
                    <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                      Desde
                      <input
                        type="date"
                        value={emisionDesdeFiltro}
                        onChange={(e) => setEmisionDesdeFiltro(e.target.value)}
                        className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                      Hasta
                      <input
                        type="date"
                        value={emisionHastaFiltro}
                        onChange={(e) => setEmisionHastaFiltro(e.target.value)}
                        className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                      />
                    </label>
                  </div>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top">
                <ViajesListadoHeaderFiltro
                  title="Vencimiento"
                  filterActive={!!vencimientoDesdeFiltro || !!vencimientoHastaFiltro}
                  filterSignature={`${vencimientoDesdeFiltro}|${vencimientoHastaFiltro}`}
                >
                  <div className="flex flex-col gap-1.5">
                    <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                      Desde
                      <input
                        type="date"
                        value={vencimientoDesdeFiltro}
                        onChange={(e) => setVencimientoDesdeFiltro(e.target.value)}
                        className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                      Hasta
                      <input
                        type="date"
                        value={vencimientoHastaFiltro}
                        onChange={(e) => setVencimientoHastaFiltro(e.target.value)}
                        className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                      />
                    </label>
                  </div>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top">
                <ViajesListadoHeaderFiltro
                  title="Estado"
                  filterActive={!!estadoFiltro}
                  filterSignature={estadoFiltro}
                >
                  <select
                    value={estadoFiltro}
                    onChange={(e) => setEstadoFiltro(e.target.value)}
                    className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      estadoFiltro ? 'text-vialto-fire' : 'text-vialto-charcoal'
                    }`}
                    aria-label="Filtrar por estado"
                  >
                    <option value="">Todos</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="cobrada">Cobrada</option>
                    <option value="vencida">Vencida</option>
                  </select>
                </ViajesListadoHeaderFiltro>
              </th>
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
            {facturasFiltradas?.length === 0 && facturas !== null && facturas.length > 0 && (
              <tr><td colSpan={COL_SPAN} className="px-4 py-8 text-vialto-steel">
                No hay facturas que coincidan con los filtros aplicados.
              </td></tr>
            )}

            {facturasFiltradas?.map((f) => (
                <Fragment key={f.id}>
                  <tr className="border-b border-black/5 hover:bg-vialto-mist/40">
                    <td className="px-4 py-3 font-medium break-all">{f.numero}</td>
                    <td className="px-4 py-3 leading-snug">{TIPO_LABEL[f.tipo] ?? f.tipo}</td>
                    <td className="px-4 py-3 truncate" title={nombreContraparte(f)}>{nombreContraparte(f)}</td>
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
                        onVer={() => setViewingFactura(f)}
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
        <p className="mt-3 text-xs text-vialto-steel">
          {anyFiltroActivo && facturasFiltradas !== null
            ? `${facturasFiltradas.length} de ${facturas.length} factura${facturas.length !== 1 ? 's' : ''}`
            : `${facturas.length} factura${facturas.length !== 1 ? 's' : ''}`}
        </p>
      )}

      <FacturaCreateModal
        open={creating}
        draft={draft}
        setDraft={setDraft}
        clientes={clientes}
        transportistas={transportistas}
        viajes={viajes}
        viajesNueva={viajesNuevaFactura}
        viajesLoading={viajesLoading}
        onClose={() => { setCreating(false); setDraftError(null); }}
        onSave={() => void handleCreate()}
        saving={saving}
        error={draftError}
      />

      {viewingFactura && (
        <FacturaViewModal
          factura={viewingFactura}
          clienteNombre={nombreCliente(viewingFactura.clienteId)}
          onClose={() => setViewingFactura(null)}
          onEditar={() => {
            const f = viewingFactura;
            setViewingFactura(null);
            startEdit(f);
          }}
        />
      )}

      {editingId && editDraft && facturaEdicionSnapshot && (
        <FacturaEditModal
          open
          draft={editDraft}
          setDraft={setEditDraft}
          snapshotFactura={facturaEdicionSnapshot}
          clientes={clientes}
          transportistas={transportistas}
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
