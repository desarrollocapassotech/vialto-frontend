import { useAuth } from '@clerk/clerk-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { useTenantsList } from '@/hooks/useTenantsList';
import { apiJson } from '@/lib/api';
import type { Cliente, Factura, Pago, Viaje } from '@/types/api';

// ─── helpers (copiados de FacturacionTenantPage) ─────────────────────────────

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  cobrada: 'Cobrada',
  vencida: 'Vencida',
};

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-950 border-amber-300/90',
  cobrada: 'bg-emerald-100 text-emerald-950 border-emerald-500/80',
  vencida: 'bg-red-100 text-red-950 border-red-400/80',
};

const TIPO_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  transportista_externo: 'Fletero',
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

type PagoDraft = { importe: string; fecha: string; formaPago: string };

type FacturaDraft = {
  numero: string;
  tipo: 'cliente' | 'transportista_externo';
  clienteId: string;
  viajeId: string;
  importe: string;
  fechaEmision: string;
  fechaVencimiento: string;
  estado: 'pendiente' | 'cobrada' | 'vencida';
};

type FacturaNuevaNavState = {
  tenantId?: string;
  newFacturaDraft?: { clienteId: string; viajeId: string; importe: number };
};

function emptyPagoDraft(): PagoDraft {
  return { importe: '', fecha: todayIso(), formaPago: '' };
}

function emptyFacturaDraft(): FacturaDraft {
  return {
    numero: '',
    tipo: 'cliente',
    clienteId: '',
    viajeId: '',
    importe: '',
    fechaEmision: todayIso(),
    fechaVencimiento: '',
    estado: 'pendiente',
  };
}

// ─── componente ──────────────────────────────────────────────────────────────

export function FacturacionSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  const tenants = useTenantsList();
  const [filtroEmpresa, setFiltroEmpresa] = useState('');

  // crear factura
  const [creating, setCreating] = useState(false);
  const [facturaDraft, setFacturaDraft] = useState<FacturaDraft>(emptyFacturaDraft());
  const [facturaDraftError, setFacturaDraftError] = useState<string | null>(null);
  const [savingFactura, setSavingFactura] = useState(false);

  const [facturas, setFacturas] = useState<Factura[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingEstadoId, setSavingEstadoId] = useState<string | null>(null);
  const [pagoDraftFacturaId, setPagoDraftFacturaId] = useState<string | null>(null);
  const [pagoDraft, setPagoDraft] = useState<PagoDraft | null>(null);
  const [savingPago, setSavingPago] = useState(false);
  const [pagoError, setPagoError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRef = useRef(0);

  // ── carga al cambiar empresa ────────────────────────────────────────────────

  useEffect(() => {
    setFacturas(null);
    setClientes([]);
    setViajes([]);
    setError(null);
    setExpandedId(null);
    setPagoDraftFacturaId(null);
    setPagoDraft(null);

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

  async function refetchFacturas() {
    if (!filtroEmpresa) return;
    const gen = ++fetchRef.current;
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    try {
      const data = await apiJson<Factura[]>(`/api/platform/facturas?${q}`, () => getToken());
      if (gen === fetchRef.current) setFacturas(data);
    } catch {
      // silencioso
    }
  }

  // ── pre-fill desde navegación (viaje → facturado sin cobrar) ───────────────

  useEffect(() => {
    const state = location.state as FacturaNuevaNavState | null;
    if (!state?.newFacturaDraft) return;
    const { clienteId, viajeId, importe } = state.newFacturaDraft;
    const importeStr =
      importe > 0
        ? importe.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';
    if (state.tenantId) setFiltroEmpresa(state.tenantId);
    setFacturaDraft({
      ...emptyFacturaDraft(),
      clienteId: clienteId ?? '',
      viajeId: viajeId ?? '',
      importe: importeStr,
    });
    setCreating(true);
    window.history.replaceState({}, '');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── crear factura ───────────────────────────────────────────────────────────

  function setD(patch: Partial<FacturaDraft>) {
    setFacturaDraft((prev) => ({ ...prev, ...patch }));
  }

  async function handleCreateFactura(e: React.FormEvent) {
    e.preventDefault();
    setFacturaDraftError(null);
    if (!filtroEmpresa) { setFacturaDraftError('Seleccioná una empresa.'); return; }
    const importe = parseFloat(facturaDraft.importe.replace(/\./g, '').replace(',', '.'));
    if (!facturaDraft.numero.trim()) { setFacturaDraftError('Ingresá el número de factura.'); return; }
    if (isNaN(importe) || importe <= 0) { setFacturaDraftError('Ingresá un importe mayor a 0.'); return; }
    if (!facturaDraft.fechaEmision) { setFacturaDraftError('Ingresá la fecha de emisión.'); return; }

    setSavingFactura(true);
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    try {
      await apiJson<Factura>(`/api/platform/facturas?${q}`, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          numero: facturaDraft.numero.trim(),
          tipo: facturaDraft.tipo,
          clienteId: facturaDraft.clienteId || undefined,
          viajeId: facturaDraft.viajeId || undefined,
          importe,
          fechaEmision: facturaDraft.fechaEmision,
          fechaVencimiento: facturaDraft.fechaVencimiento || undefined,
          estado: facturaDraft.estado,
        }),
      });
      setCreating(false);
      setFacturaDraft(emptyFacturaDraft());
      await refetchFacturas();
    } catch (e) {
      setFacturaDraftError(e instanceof Error ? e.message : 'No se pudo guardar la factura.');
    } finally {
      setSavingFactura(false);
    }
  }

  // ── cambiar estado ──────────────────────────────────────────────────────────

  async function handleEstado(f: Factura, estado: Factura['estado']) {
    if (f.estado === estado) return;
    setSavingEstadoId(f.id);
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    try {
      const updated = await apiJson<Factura>(
        `/api/platform/facturas/${f.id}?${q}`,
        () => getToken(),
        { method: 'PATCH', body: JSON.stringify({ estado }) },
      );
      setFacturas((prev) => prev?.map((r) => (r.id === f.id ? updated : r)) ?? prev);
    } catch {
      // silencioso
    } finally {
      setSavingEstadoId(null);
    }
  }

  // ── registrar pago ──────────────────────────────────────────────────────────

  function abrirPago(facturaId: string) {
    setPagoDraftFacturaId(facturaId);
    setPagoDraft(emptyPagoDraft());
    setPagoError(null);
  }

  async function handleRegistrarPago(e: React.FormEvent) {
    e.preventDefault();
    if (!pagoDraft || !pagoDraftFacturaId) return;
    setPagoError(null);

    const importe = parseFloat(pagoDraft.importe.replace(/\./g, '').replace(',', '.'));
    if (isNaN(importe) || importe <= 0) { setPagoError('Ingresá un importe mayor a 0.'); return; }
    if (!pagoDraft.fecha) { setPagoError('Ingresá la fecha del pago.'); return; }

    setSavingPago(true);
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    try {
      await apiJson<Pago>(`/api/platform/pagos?${q}`, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          facturaId: pagoDraftFacturaId,
          importe,
          fecha: pagoDraft.fecha,
          formaPago: pagoDraft.formaPago || undefined,
        }),
      });
      setPagoDraft(null);
      setPagoDraftFacturaId(null);
      await refetchFacturas();
    } catch (e) {
      setPagoError(e instanceof Error ? e.message : 'No se pudo registrar el pago.');
    } finally {
      setSavingPago(false);
    }
  }

  // ── eliminar pago ───────────────────────────────────────────────────────────

  async function handleDeletePago(pago: Pago) {
    if (!confirm('¿Eliminás este pago?')) return;
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    try {
      await apiJson(`/api/platform/pagos/${pago.id}?${q}`, () => getToken(), {
        method: 'DELETE',
      });
      await refetchFacturas();
    } catch {
      // silencioso
    }
  }

  // ── eliminar factura ────────────────────────────────────────────────────────

  async function handleDelete(f: Factura) {
    if (!confirm(`¿Eliminás la factura ${f.numero}?`)) return;
    setDeletingId(f.id);
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    try {
      await apiJson(`/api/platform/facturas/${f.id}?${q}`, () => getToken(), {
        method: 'DELETE',
      });
      setFacturas((prev) => prev?.filter((r) => r.id !== f.id) ?? prev);
      if (expandedId === f.id) setExpandedId(null);
    } catch {
      // silencioso
    } finally {
      setDeletingId(null);
    }
  }

  // ── lookups ─────────────────────────────────────────────────────────────────

  function nombreCliente(id: string | null) {
    if (!id) return '—';
    return clientes.find((c) => c.id === id)?.nombre ?? id;
  }

  function numeroViaje(id: string | null) {
    if (!id) return null;
    return viajes.find((v) => v.id === id)?.numero ?? null;
  }

  // ── render ──────────────────────────────────────────────────────────────────

  const COL_SPAN = 7;

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
            onChange={(v) => { setFiltroEmpresa(v); }}
          />
        </div>
        {filtroEmpresa && (
          <button
            type="button"
            onClick={() => {
              setCreating((v) => !v);
              setFacturaDraft(emptyFacturaDraft());
              setFacturaDraftError(null);
            }}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            {creating ? 'Cancelar' : 'Nueva factura'}
          </button>
        )}
      </div>

      {/* sin empresa seleccionada */}
      {!filtroEmpresa && (
        <p className="mt-10 text-vialto-steel text-sm">
          Seleccioná una empresa para ver sus facturas.
        </p>
      )}

      {/* formulario de creación */}
      {creating && filtroEmpresa && (
        <form
          onSubmit={handleCreateFactura}
          className="mt-4 bg-white border border-black/10 rounded shadow-sm p-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <h2 className="col-span-full font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.2em] text-vialto-fire">
            Nueva factura
          </h2>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Número *</label>
            <input
              type="text"
              value={facturaDraft.numero}
              onChange={(e) => setD({ numero: e.target.value })}
              placeholder="0001-00000001"
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Tipo *</label>
            <select
              value={facturaDraft.tipo}
              onChange={(e) => setD({ tipo: e.target.value as FacturaDraft['tipo'] })}
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            >
              <option value="cliente">Factura a cliente</option>
              <option value="transportista_externo">Factura a fletero</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Cliente</label>
            <select
              value={facturaDraft.clienteId}
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
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Viaje vinculado</label>
            <select
              value={facturaDraft.viajeId}
              onChange={(e) => setD({ viajeId: e.target.value })}
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            >
              <option value="">— Sin viaje —</option>
              {viajes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.numero} — {v.origen ?? '?'} → {v.destino ?? '?'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Importe *</label>
            <input
              type="text"
              inputMode="decimal"
              value={facturaDraft.importe}
              onChange={(e) => setD({ importe: e.target.value })}
              placeholder="0,00"
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Estado inicial</label>
            <select
              value={facturaDraft.estado}
              onChange={(e) => setD({ estado: e.target.value as FacturaDraft['estado'] })}
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            >
              <option value="pendiente">Pendiente</option>
              <option value="cobrada">Cobrada</option>
              <option value="vencida">Vencida</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Fecha de emisión *</label>
            <input
              type="date"
              value={facturaDraft.fechaEmision}
              onChange={(e) => setD({ fechaEmision: e.target.value })}
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider text-vialto-steel">Fecha de vencimiento</label>
            <input
              type="date"
              value={facturaDraft.fechaVencimiento}
              onChange={(e) => setD({ fechaVencimiento: e.target.value })}
              className="h-9 border border-black/20 px-3 text-sm bg-white"
            />
          </div>

          {facturaDraftError && (
            <p className="col-span-full text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {facturaDraftError}
            </p>
          )}

          <div className="col-span-full flex gap-3 pt-1">
            <button
              type="submit"
              disabled={savingFactura}
              className="h-9 px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-50"
            >
              {savingFactura ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setFacturaDraftError(null); }}
              className="h-9 px-4 border border-black/20 text-sm uppercase tracking-wider hover:bg-vialto-mist"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* error */}
      {error && filtroEmpresa && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
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
                <th className="px-4 py-3">Viaje</th>
                <th className="px-4 py-3 text-right">Importe</th>
                <th className="px-4 py-3">Emisión / Vencimiento</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {facturas === null && !error && (
                <tr>
                  <td colSpan={COL_SPAN + 1} className="px-4 py-8 text-vialto-steel">
                    Cargando…
                  </td>
                </tr>
              )}
              {facturas?.length === 0 && (
                <tr>
                  <td colSpan={COL_SPAN + 1} className="px-4 py-8 text-vialto-steel">
                    Esta empresa no tiene facturas registradas.
                  </td>
                </tr>
              )}

              {facturas?.map((f) => {
                const expanded = expandedId === f.id;
                const totalPagado = f.pagos.reduce((s, p) => s + p.importe, 0);
                const saldo = f.importe - totalPagado;

                return (
                  <>
                    <tr
                      key={f.id}
                      className="border-b border-black/5 hover:bg-vialto-mist/60 cursor-pointer"
                      onClick={() => setExpandedId(expanded ? null : f.id)}
                    >
                      <td className="px-4 py-3 font-medium">{f.numero}</td>
                      <td className="px-4 py-3 text-vialto-steel">
                        {TIPO_LABEL[f.tipo] ?? f.tipo}
                      </td>
                      <td className="px-4 py-3">{nombreCliente(f.clienteId)}</td>
                      <td className="px-4 py-3 text-vialto-steel">
                        {numeroViaje(f.viajeId) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {fmtMonto(f.importe)}
                      </td>
                      <td className="px-4 py-3 text-vialto-steel whitespace-nowrap tabular-nums">
                        {fmtFecha(f.fechaEmision)}
                        {f.fechaVencimiento && (
                          <span className="ml-1 text-xs text-vialto-steel/70">
                            → {fmtFecha(f.fechaVencimiento)}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={f.estado}
                          disabled={savingEstadoId === f.id}
                          onChange={(e) =>
                            handleEstado(f, e.target.value as Factura['estado'])
                          }
                          className={[
                            'border rounded px-2 py-0.5 text-xs font-medium cursor-pointer',
                            ESTADO_BADGE[f.estado] ?? '',
                          ].join(' ')}
                        >
                          {(['pendiente', 'cobrada', 'vencida'] as const).map((s) => (
                            <option key={s} value={s}>
                              {ESTADO_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => { setExpandedId(f.id); abrirPago(f.id); }}
                            className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                          >
                            + Pago
                          </button>
                          <button
                            type="button"
                            disabled={deletingId === f.id}
                            onClick={() => handleDelete(f)}
                            className="text-xs uppercase tracking-wider px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40"
                          >
                            {deletingId === f.id ? '…' : 'Eliminar'}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* fila expandida */}
                    {expanded && (
                      <tr key={`${f.id}-pagos`} className="bg-vialto-mist/40">
                        <td colSpan={COL_SPAN + 1} className="px-6 py-4">
                          <div className="space-y-3">
                            <div className="flex gap-6 text-sm">
                              <span>
                                <span className="text-vialto-steel">Total factura:</span>{' '}
                                <span className="font-medium tabular-nums">{fmtMonto(f.importe)}</span>
                              </span>
                              <span>
                                <span className="text-vialto-steel">Pagado:</span>{' '}
                                <span className="font-medium tabular-nums text-emerald-700">{fmtMonto(totalPagado)}</span>
                              </span>
                              <span>
                                <span className="text-vialto-steel">Saldo:</span>{' '}
                                <span className={['font-medium tabular-nums', saldo > 0 ? 'text-amber-700' : 'text-emerald-700'].join(' ')}>
                                  {fmtMonto(saldo)}
                                </span>
                              </span>
                            </div>

                            {f.pagos.length === 0 ? (
                              <p className="text-sm text-vialto-steel">Sin pagos registrados.</p>
                            ) : (
                              <table className="w-full text-sm border border-black/10 rounded bg-white">
                                <thead>
                                  <tr className="border-b border-black/10 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire bg-vialto-mist">
                                    <th className="px-3 py-2">Fecha</th>
                                    <th className="px-3 py-2 text-right">Importe</th>
                                    <th className="px-3 py-2">Forma de pago</th>
                                    <th className="px-3 py-2 text-right">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {f.pagos.map((p) => (
                                    <tr key={p.id} className="border-b border-black/5">
                                      <td className="px-3 py-2 tabular-nums">{fmtFecha(p.fecha)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMonto(p.importe)}</td>
                                      <td className="px-3 py-2 text-vialto-steel capitalize">{p.formaPago ?? '—'}</td>
                                      <td className="px-3 py-2 text-right">
                                        <button
                                          type="button"
                                          onClick={() => handleDeletePago(p)}
                                          className="text-xs px-2 py-0.5 border border-red-200 text-red-700 hover:bg-red-50"
                                        >
                                          Eliminar
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}

                            {pagoDraftFacturaId === f.id && pagoDraft ? (
                              <form
                                onSubmit={handleRegistrarPago}
                                className="flex flex-wrap gap-3 items-end pt-2"
                              >
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs uppercase tracking-wider text-vialto-steel">Importe *</label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={pagoDraft.importe}
                                    onChange={(e) => setPagoDraft((p) => p && { ...p, importe: e.target.value })}
                                    placeholder="0,00"
                                    className="h-9 w-36 border border-black/20 px-3 text-sm bg-white"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs uppercase tracking-wider text-vialto-steel">Fecha *</label>
                                  <input
                                    type="date"
                                    value={pagoDraft.fecha}
                                    onChange={(e) => setPagoDraft((p) => p && { ...p, fecha: e.target.value })}
                                    className="h-9 border border-black/20 px-3 text-sm bg-white"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs uppercase tracking-wider text-vialto-steel">Forma de pago</label>
                                  <select
                                    value={pagoDraft.formaPago}
                                    onChange={(e) => setPagoDraft((p) => p && { ...p, formaPago: e.target.value })}
                                    className="h-9 border border-black/20 px-3 text-sm bg-white"
                                  >
                                    <option value="">— —</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="efectivo">Efectivo</option>
                                  </select>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="submit"
                                    disabled={savingPago}
                                    className="h-9 px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-50"
                                  >
                                    {savingPago ? '…' : 'Registrar'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setPagoDraft(null); setPagoDraftFacturaId(null); setPagoError(null); }}
                                    className="h-9 px-3 border border-black/20 text-sm hover:bg-vialto-mist"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                                {pagoError && (
                                  <p className="w-full text-sm text-red-700">{pagoError}</p>
                                )}
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => abrirPago(f.id)}
                                className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-white"
                              >
                                + Registrar pago
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtroEmpresa && facturas && facturas.length > 0 && (
        <p className="mt-3 text-xs text-vialto-steel">
          {facturas.length} factura{facturas.length !== 1 ? 's' : ''} · Hacé clic en una fila para ver los pagos.
        </p>
      )}
    </div>
  );
}
