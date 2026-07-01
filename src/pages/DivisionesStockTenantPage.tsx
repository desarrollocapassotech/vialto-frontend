import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { Spinner } from '@/components/ui/Spinner';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { LoteSelect } from '@/components/stock/LoteSelect';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import type { Cliente, Deposito, Producto, ProductoPresentacion, StockItem } from '@/types/api';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';

type PaginatedProductos = { items: Producto[]; meta: unknown };

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

function buildQs(params: Record<string, string | number>, tenantId?: string): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  for (const [k, v] of Object.entries(params))
    parts.push(`${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function DivisionesStockTenantPage({
  tenantId,
  clientesExternos,
  clientesExternosLoading,
}: {
  tenantId?: string;
  clientesExternos?: Cliente[];
  clientesExternosLoading?: boolean;
}) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const maestro = useMaestroData();
  const platform = Boolean(tenantId);

  const clientes = useMemo(
    () => clientesExternos ?? maestro.clientes,
    [clientesExternos, maestro.clientes],
  );
  const clientesSelectLoading = platform ? Boolean(clientesExternosLoading) : maestro.loading;

  const productosBase = platform ? '/api/platform/stock/productos' : '/api/stock/productos';
  const divisionesUrl = platform
    ? `/api/platform/stock/divisiones${buildQs({}, tenantId)}`
    : '/api/stock/divisiones';
  const disponibleBase = platform ? '/api/platform/stock/disponible' : '/api/stock/disponible';
  const depositosBase = platform ? '/api/platform/stock/depositos' : '/api/stock/depositos';
  const lotesBase = platform ? '/api/platform/stock/lotes' : '/api/stock/lotes';

  const [productos, setProductos] = useState<Producto[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [productosLoading, setProductosLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clienteId, setClienteId] = useState('');
  const [depositoId, setDepositoId] = useState('');
  const [productoId, setProductoId] = useState('');
  const [presentacionId, setPresentacionId] = useState('');
  const [bultos, setBultos] = useState(1);
  const [lote, setLote] = useState('');
  const [loteDisponible, setLoteDisponible] = useState<number | null>(null);

  const partesInicial = isoToFechaHora(new Date().toISOString());
  const [fechaMov, setFechaMov] = useState(partesInicial.fecha);
  const [horaMov, setHoraMov] = useState(partesInicial.hora);
  const [fechaMovError, setFechaMovError] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [mostrarObs, setMostrarObs] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [allStockItems, setAllStockItems] = useState<StockItem[]>([]);
  const [allStockLoading, setAllStockLoading] = useState(true);

  const productoSeleccionado = useMemo(
    () => productos.find((p) => p.id === productoId) ?? null,
    [productos, productoId],
  );

  const productosConPresentaciones = useMemo(
    () => productos.filter((p) => p.productoPresentaciones.length > 0),
    [productos],
  );

  const presentacionSeleccionada: ProductoPresentacion | null = useMemo(() => {
    if (!productoSeleccionado || !presentacionId) return null;
    return (
      productoSeleccionado.productoPresentaciones.find((pp) => pp.id === presentacionId) ?? null
    );
  }, [productoSeleccionado, presentacionId]);

  const unidadesPorBulto = presentacionSeleccionada?.unidadesPorBulto ?? 0;
  const sueltasResultantes = bultos * unidadesPorBulto;

  const stockDisponible: StockItem | null = useMemo(() => {
    if (!productoId || !clienteId || !depositoId || !presentacionId) return null;
    return (
      stockItems.find(
        (s) =>
          s.productoId === productoId &&
          s.clienteId === clienteId &&
          s.depositoId === depositoId &&
          s.presentacionId === presentacionId,
      ) ?? null
    );
  }, [stockItems, productoId, clienteId, depositoId, presentacionId]);

  // Si hay lote seleccionado, usar su balance específico; si no, el total del StockItem
  const bultosDisponibles = lote
    ? (loteDisponible ?? 0)
    : (stockDisponible?.cantidad1 ?? 0);

  const clientesFiltrados = useMemo(() => {
    if (allStockLoading) return [];
    const ids = new Set(allStockItems.map((s) => s.clienteId));
    return clientes.filter((c) => ids.has(c.id));
  }, [clientes, allStockItems, allStockLoading]);

  const depositosFiltrados = useMemo(() => {
    if (allStockLoading) return [];
    const items = clienteId
      ? allStockItems.filter((s) => s.clienteId === clienteId)
      : allStockItems;
    const ids = new Set(items.map((s) => s.depositoId));
    return depositos.filter((d) => ids.has(d.id));
  }, [depositos, allStockItems, allStockLoading, clienteId]);

  const loadProductos = useCallback(async () => {
    setProductosLoading(true);
    setLoadError(null);
    try {
      const url = `${productosBase}/paginated${buildQs(
        { page: 1, pageSize: 100, filtroActivo: 'activos' },
        tenantId,
      )}`;
      const data = await apiJson<PaginatedProductos>(url, () => getToken());
      setProductos(data.items);
    } catch (e) {
      setLoadError(friendlyError(e, 'stock'));
    } finally {
      setProductosLoading(false);
    }
  }, [productosBase, tenantId, getToken]);

  useEffect(() => {
    void loadProductos();
  }, [loadProductos]);

  useEffect(() => {
    const url = `${depositosBase}${buildQs({ activo: '1' }, tenantId)}`;
    void apiJson<Deposito[]>(url, () => getToken())
      .then(setDepositos)
      .catch(() => setDepositos([]));
  }, [depositosBase, tenantId, getToken]);

  // Todo el stock del tenant (sin filtros) — para filtrar clientes y depósitos con bultos
  useEffect(() => {
    setAllStockLoading(true);
    void apiJson<StockItem[]>(`${disponibleBase}${buildQs({}, tenantId)}`, () => getToken())
      .then((items) => setAllStockItems(items.filter((s) => s.cantidad1 > 0)))
      .catch(() => setAllStockItems([]))
      .finally(() => setAllStockLoading(false));
  }, [disponibleBase, tenantId, getToken]);

  useEffect(() => {
    if (!productoId || !clienteId) {
      setStockItems([]);
      return;
    }
    setStockLoading(true);
    const qs = buildQs({ productoId, clienteId }, tenantId);
    void apiJson<StockItem[]>(`${disponibleBase}${qs}`, () => getToken())
      .then((items) => setStockItems(items.filter((s) => s.cantidad1 > 0 || s.cantidad2 > 0)))
      .catch(() => setStockItems([]))
      .finally(() => setStockLoading(false));
  }, [productoId, clienteId, disponibleBase, tenantId, getToken]);

  // Auto-seleccionar si hay una sola presentación
  useEffect(() => {
    if (!productoSeleccionado) {
      setPresentacionId('');
      return;
    }
    const pps = productoSeleccionado.productoPresentaciones;
    setPresentacionId(pps.length === 1 ? pps[0].id : '');
    setBultos(1);
  }, [productoSeleccionado]);

  function resetForm() {
    setClienteId('');
    setDepositoId('');
    setProductoId('');
    setPresentacionId('');
    setBultos(1);
    const p = isoToFechaHora(new Date().toISOString());
    setFechaMov(p.fecha);
    setHoraMov(p.hora);
    setFechaMovError(null);
    setObservaciones('');
    setMostrarObs(false);
    setLote('');
    setLoteDisponible(null);
    setStockItems([]);
    setFormError(null);
    setFieldErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const ferrs: Record<string, string> = {};
    if (!clienteId) ferrs.clienteId = 'Seleccioná una empresa.';
    if (!depositoId) ferrs.depositoId = 'Seleccioná un depósito.';
    if (!productoId) ferrs.productoId = 'Seleccioná un producto.';
    if (!presentacionId) ferrs.presentacionId = 'Seleccioná una presentación.';
    if (Object.keys(ferrs).length > 0) {
      setFieldErrors(ferrs);
      return;
    }
    setFieldErrors({});

    if (bultos < 1) return setFormError('La cantidad de bultos debe ser al menos 1.');
    if (bultosDisponibles > 0 && bultos > bultosDisponibles) {
      return setFormError(
        `Stock insuficiente. Tenés ${bultosDisponibles} bulto${bultosDisponibles !== 1 ? 's' : ''} disponible${bultosDisponibles !== 1 ? 's' : ''}.`,
      );
    }

    const fmError = !fechaMov.trim() ? 'Ingresá la fecha.' : null;
    setFechaMovError(fmError);
    if (fmError) return setFormError(fmError);

    const fechaIso = fechaHoraToIso(fechaMov, horaMov);
    if (!fechaIso) return setFormError('Revisá la fecha y hora.');

    setSaving(true);
    try {
      await apiJson(divisionesUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          productoId,
          presentacionId,
          clienteId,
          depositoId,
          bultos,
          fecha: fechaIso,
          ...(lote.trim() ? { lote: lote.trim() } : {}),
          ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
        }),
      });
      showToast('División registrada correctamente.');
      resetForm();
    } catch (e) {
      setFormError(friendlyError(e, 'stock'));
    } finally {
      setSaving(false);
    }
  }

  const historialHref = platform
    ? `/stock/divisiones/historial?tenantId=${encodeURIComponent(tenantId!)}`
    : '/stock/divisiones/historial';

  const readyToConvert = Boolean(
    clienteId && depositoId && productoId && presentacionId && unidadesPorBulto > 0,
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {!platform && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-vialto-charcoal">División de bultos</h1>
            <p className="mt-1 text-sm text-vialto-steel">
              Convertí bultos en unidades sueltas. El stock se actualiza automáticamente.
            </p>
          </div>
          <Link
            to={historialHref}
            className="shrink-0 inline-flex items-center gap-2 rounded border border-black/15 bg-white px-3 py-1.5 text-sm font-medium text-vialto-charcoal hover:bg-vialto-mist/60 transition-colors"
          >
            <img src="/icono-historial.png" alt="" className="h-5 w-5" aria-hidden />
            Historial
          </Link>
        </div>
      )}

      {loadError && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Paso 1: Contexto */}
        <div className="bg-white rounded-lg border border-black/10 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={LABEL}>
                Empresa / Cliente <span className="text-red-500">*</span>
              </label>
              <ClienteSearchSelect
                clientes={clientesFiltrados}
                value={clienteId}
                onChange={(id) => {
                  setClienteId(id);
                  setStockItems([]);
                  const depositosParaCliente = new Set(
                    allStockItems.filter((s) => s.clienteId === id).map((s) => s.depositoId),
                  );
                  if (depositoId && !depositosParaCliente.has(depositoId)) setDepositoId('');
                }}
                loading={clientesSelectLoading || allStockLoading}
                inputClassName={`${INPUT} ${fieldErrors.clienteId ? 'border-red-400' : ''}`}
              />
              <CrudFieldError message={fieldErrors.clienteId} />
            </div>

            <div className="space-y-1">
              <label className={LABEL}>
                Depósito <span className="text-red-500">*</span>
              </label>
              <select
                value={depositoId}
                onChange={(e) => setDepositoId(e.target.value)}
                className={`h-9 w-full border bg-white px-2 text-sm ${
                  fieldErrors.depositoId ? 'border-red-400' : 'border-black/15'
                }`}
              >
                <option value="">
                  {!clienteId ? 'Primero elegí una empresa…' : 'Elegí un depósito…'}
                </option>
                {depositosFiltrados.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
              <CrudFieldError message={fieldErrors.depositoId} />
            </div>

            <div className="space-y-1">
              <label className={LABEL}>
                Producto <span className="text-red-500">*</span>
              </label>
              <SearchableEntitySelect<Producto>
                items={productosConPresentaciones}
                value={productoId}
                onChange={(id) => {
                  setProductoId(id);
                  setBultos(1);
                  setStockItems([]);
                }}
                loading={productosLoading}
                filterItems={(items, q) => {
                  const lq = q.toLowerCase();
                  return items.filter(
                    (p) =>
                      p.nombre.toLowerCase().includes(lq) ||
                      (p.codigo?.toLowerCase().includes(lq) ?? false),
                  );
                }}
                getPrimaryLabel={(p) => (p.codigo ? `[${p.codigo}] ${p.nombre}` : p.nombre)}
                placeholderCerrado="Elegí un producto…"
                placeholderBuscar="Buscar por nombre o código…"
                inputClassName={`${INPUT} ${fieldErrors.productoId ? 'border-red-400' : ''}`}
              />
              <CrudFieldError message={fieldErrors.productoId} />
            </div>

            <div className="space-y-1">
              <label className={LABEL}>
                Presentación <span className="text-red-500">*</span>
              </label>
              <select
                value={presentacionId}
                onChange={(e) => {
                  setPresentacionId(e.target.value);
                  setBultos(1);
                }}
                disabled={!productoId}
                className={`h-9 w-full border bg-white px-2 text-sm disabled:opacity-50 ${
                  fieldErrors.presentacionId ? 'border-red-400' : 'border-black/15'
                }`}
              >
                <option value="">
                  {!productoId ? 'Primero elegí un producto' : 'Elegí una presentación…'}
                </option>
                {(productoSeleccionado?.productoPresentaciones ?? []).map((pp) => (
                  <option key={pp.id} value={pp.id}>
                    {pp.presentacion?.nombre ?? pp.presentacionId} — {pp.unidadesPorBulto}{' '}
                    uds/bulto
                  </option>
                ))}
              </select>
              <CrudFieldError message={fieldErrors.presentacionId} />
            </div>

            <div className="space-y-1">
              <label className={LABEL}>Lote</label>
              <LoteSelect
                productoId={productoId}
                clienteId={clienteId}
                depositoId={depositoId}
                presentacionId={presentacionId}
                value={lote}
                onLoteChange={(l, meta) => {
                  setLote(l);
                  setLoteDisponible(meta?.cantidad1 ?? null);
                  setBultos(1);
                }}
                lotesBase={lotesBase}
                tenantId={tenantId}
                className={`${INPUT} disabled:opacity-50`}
                disabled={!productoId || !clienteId || !depositoId}
              />
            </div>
          </div>
        </div>

        {/* Paso 2: Conversión visual — aparece cuando todo el contexto está listo */}
        {readyToConvert && (
          <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
            {/* Banda de stock disponible */}
            <div className="bg-vialto-mist/40 border-b border-black/10 px-5 py-2.5 flex items-center justify-between text-sm">
              <span className="text-vialto-steel text-xs uppercase tracking-[0.08em]">
                Stock disponible
              </span>
              {stockLoading ? (
                <span className="text-vialto-steel text-sm">Verificando…</span>
              ) : bultosDisponibles > 0 ? (
                <span className="font-semibold text-vialto-charcoal">
                  {bultosDisponibles} bulto{bultosDisponibles !== 1 ? 's' : ''}
                  {!lote && (stockDisponible?.cantidad2 ?? 0) > 0 && (
                    <span className="font-normal text-vialto-steel ml-2 text-xs">
                      + {stockDisponible!.cantidad2} sueltas
                    </span>
                  )}
                  {lote && (
                    <span className="font-normal text-vialto-steel ml-2 text-xs">
                      lote {lote}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-amber-600 text-sm">
                  {lote ? `Sin stock en bultos para lote ${lote}` : 'Sin stock en bultos'}
                </span>
              )}
            </div>

            <div className="p-6 space-y-6">
              {/* Selector de cantidad — central */}
              <div className="text-center space-y-3">
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
                  ¿Cuántos bultos querés dividir?
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => setBultos((n) => Math.max(1, n - 1))}
                    disabled={bultos <= 1}
                    className="h-10 w-10 flex items-center justify-center rounded-full border border-black/20 bg-white hover:bg-vialto-mist/60 disabled:opacity-30 transition-colors"
                  >
                    <Minus className="h-4 w-4 text-vialto-charcoal" />
                  </button>

                  <input
                    type="number"
                    min={1}
                    max={bultosDisponibles > 0 ? bultosDisponibles : undefined}
                    value={bultos}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 1;
                      setBultos(Math.max(1, v));
                    }}
                    className="w-24 text-center text-4xl font-bold border-0 border-b-2 border-vialto-charcoal bg-transparent focus:outline-none focus:border-vialto-fire text-vialto-charcoal"
                  />

                  <button
                    type="button"
                    onClick={() => setBultos((n) => n + 1)}
                    disabled={bultosDisponibles > 0 && bultos >= bultosDisponibles}
                    className="h-10 w-10 flex items-center justify-center rounded-full border border-black/20 bg-white hover:bg-vialto-mist/60 disabled:opacity-30 transition-colors"
                  >
                    <Plus className="h-4 w-4 text-vialto-charcoal" />
                  </button>
                </div>
                <p className="text-xs text-vialto-steel">
                  1 bulto = {unidadesPorBulto} unidades sueltas
                </p>
              </div>

              {/* Resultado visual */}
              <div className="flex items-stretch justify-center gap-3">
                <div className="flex-1 rounded-lg bg-red-50 border border-red-200 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2">
                    Sale
                  </p>
                  <p className="text-3xl font-bold text-red-600">−{bultos}</p>
                  <p className="text-sm text-red-500 mt-1">
                    bulto{bultos !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex items-center self-center text-2xl text-vialto-steel/50 px-1 shrink-0">
                  →
                </div>

                <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500 mb-2">
                    Entra
                  </p>
                  <p className="text-3xl font-bold text-emerald-700">+{sueltasResultantes}</p>
                  <p className="text-sm text-emerald-600 mt-1">sueltas</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fecha + obs + submit */}
        <div className="bg-white rounded-lg border border-black/10 p-5 space-y-4">
          <ViajeFechaHoraFields
            mode="cargaOnly"
            fechaCarga={fechaMov}
            horaCarga={horaMov}
            fechaDescarga=""
            horaDescarga=""
            onPatch={(p) => {
              if (p.fechaCarga !== undefined) {
                setFechaMov(p.fechaCarga);
                if (p.fechaCarga) setFechaMovError(null);
              }
              if (p.horaCarga !== undefined) setHoraMov(p.horaCarga);
            }}
            labelClassName={LABEL}
            inputClassName={INPUT}
            errorFechaCarga={fechaMovError}
          />

          {mostrarObs ? (
            <div className="space-y-1">
              <label className={LABEL}>Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                className="w-full border border-black/15 bg-white px-2 py-1.5 text-sm resize-none"
                placeholder="Notas internas…"
                autoFocus
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMostrarObs(true)}
              className="text-xs text-vialto-steel hover:text-vialto-charcoal underline"
            >
              + Agregar observación
            </button>
          )}

          <CrudFormErrorAlert message={formError} />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !readyToConvert}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-vialto-fire text-white text-sm font-semibold rounded hover:bg-vialto-fire/90 transition-colors disabled:opacity-50"
            >
              {saving && <Spinner />}
              {saving ? 'Guardando…' : 'Registrar división'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
