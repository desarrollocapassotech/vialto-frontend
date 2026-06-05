import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/lib/toast';
import { Spinner } from '@/components/ui/Spinner';
import { Link } from 'react-router-dom';
import { CircleHelp, X } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import type { Cliente, Deposito, Producto, StockItem } from '@/types/api';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';

type PaginatedProductos = { items: Producto[]; meta: unknown };

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

function buildQs(params: Record<string, string | number>, tenantId?: string): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  for (const [k, v] of Object.entries(params)) parts.push(`${k}=${encodeURIComponent(String(v))}`);
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

  const [productos, setProductos] = useState<Producto[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productosLoading, setProductosLoading] = useState(true);

  const [productoId, setProductoId] = useState('');
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  const [clienteId, setClienteId] = useState('');
  const [depositoId, setDepositoId] = useState('');
  const [cantidad1Origen, setPalletsOrigen] = useState('');
  const [cantidad2Origen, setSueltoOrigen] = useState('');
  const [cantidad1Destino, setPalletsDestino] = useState('');
  const [cantidad2Destino, setSueltoDestino] = useState('');
  const partesInicial = isoToFechaHora(new Date().toISOString());
  const [fechaMov, setFechaMov] = useState(partesInicial.fecha);
  const [horaMov, setHoraMov] = useState(partesInicial.hora);
  const [fechaMovError, setFechaMovError] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [stockDisponible, setStockDisponible] = useState<StockItem | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

  const loadProductos = useCallback(async () => {
    setProductosLoading(true);
    setLoadError(null);
    try {
      const url = `${productosBase}/paginated${buildQs({ page: 1, pageSize: 100, filtroActivo: 'activos' }, tenantId)}`;
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

  useEffect(() => {
    if (!productoId || !clienteId || !depositoId) {
      setStockDisponible(null);
      return;
    }
    setStockLoading(true);
    const qs = buildQs({ productoId, clienteId, depositoId }, tenantId);
    void apiJson<StockItem[]>(`${disponibleBase}${qs}`, () => getToken())
      .then((items) => {
        const match = items.find(
          (s) => s.productoId === productoId && s.clienteId === clienteId && s.depositoId === depositoId,
        );
        setStockDisponible(match ?? null);
      })
      .catch(() => setStockDisponible(null))
      .finally(() => setStockLoading(false));
  }, [productoId, clienteId, depositoId, disponibleBase, tenantId, getToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!productoId) return setFormError('Seleccioná un producto.');
    if (!clienteId) return setFormError('Seleccioná una empresa/cliente.');
    if (!depositoId) return setFormError('Seleccioná un depósito.');

    const po = parseFloat(cantidad1Origen) || 0;
    const so = parseFloat(cantidad2Origen) || 0;
    const pd = parseFloat(cantidad1Destino) || 0;
    const sd = parseFloat(cantidad2Destino) || 0;

    const u1 = productoSeleccionado?.unidad1Nombre ?? 'Pallets';
    const u2 = productoSeleccionado?.unidad2Nombre ?? null;
    if (po <= 0 && (u2 === null || so <= 0)) {
      return setFormError(`Ingresá al menos una cantidad de origen (${u1}${u2 ? ` o ${u2}` : ''}) mayor a 0.`);
    }
    if (pd <= 0 && (u2 === null || sd <= 0)) {
      return setFormError(`Ingresá al menos una cantidad de destino (${u1}${u2 ? ` o ${u2}` : ''}) mayor a 0.`);
    }
    if (po < 0 || so < 0 || pd < 0 || sd < 0) {
      return setFormError('Las cantidades no pueden ser negativas.');
    }

    const fmError = !fechaMov.trim() ? 'Ingresá la fecha del movimiento.' : null;
    setFechaMovError(fmError);
    if (fmError) return setFormError(fmError);

    const fechaIso = fechaHoraToIso(fechaMov, horaMov);
    if (!fechaIso) return setFormError('Revisá la fecha y hora del movimiento.');

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        productoId,
        clienteId,
        depositoId,
        fecha: fechaIso,
      };
      if (po > 0) body.cantidad1Origen = po;
      if (so > 0) body.cantidad2Origen = so;
      if (pd > 0) body.cantidad1Destino = pd;
      if (sd > 0) body.cantidad2Destino = sd;
      if (observaciones.trim()) body.observaciones = observaciones.trim();

      await apiJson(divisionesUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify(body),
      });

      showToast('División registrada correctamente.');
      setProductoId('');
      setProductoSeleccionado(null);
      setClienteId('');
      setDepositoId('');
      setPalletsOrigen('');
      setSueltoOrigen('');
      setPalletsDestino('');
      setSueltoDestino('');
      const p = isoToFechaHora(new Date().toISOString());
      setFechaMov(p.fecha);
      setHoraMov(p.hora);
      setFechaMovError(null);
      setObservaciones('');
      setStockDisponible(null);
    } catch (e) {
      setFormError(friendlyError(e, 'stock'));
    } finally {
      setSaving(false);
    }
  }

  const historialHref = platform
    ? `/stock/divisiones/historial?tenantId=${encodeURIComponent(tenantId!)}`
    : '/stock/divisiones/historial';

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {!platform && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-vialto-charcoal">División de bultos</h1>
            <p className="mt-1 text-sm text-vialto-steel">
              Convertí pallets a suelto (o viceversa). El stock se actualiza de forma automática al guardar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAyudaAbierta(true)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded border border-black/15 bg-white px-3 py-1.5 text-sm text-vialto-steel hover:bg-vialto-mist/60 transition-colors"
            aria-label="Cómo funciona la división"
          >
            <CircleHelp className="h-4 w-4" />
            ¿Cómo funciona?
          </button>
        </div>
      )}

      {loadError && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-vialto-charcoal"></h2>
        <Link
          to={historialHref}
          className="shrink-0 inline-flex items-center gap-2 rounded border border-black/15 bg-white px-3 py-1.5 text-sm font-medium text-vialto-charcoal hover:bg-vialto-mist/60 transition-colors"
        >
          <img src="/icono-historial.png" alt="" className="h-5 w-5" aria-hidden />
          Historial
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-black/10 p-6 space-y-5">
        <h2 className="text-base font-semibold text-vialto-charcoal">Nueva división</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={LABEL}>Producto</label>
            <SearchableEntitySelect<Producto>
              items={productos}
              value={productoId}
              onChange={(id) => {
                setProductoId(id);
                setProductoSeleccionado(productos.find((p) => p.id === id) ?? null);
                setPalletsOrigen('');
                setSueltoOrigen('');
                setPalletsDestino('');
                setSueltoDestino('');
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
              getPrimaryLabel={(p) =>
                p.codigo ? `[${p.codigo}] ${p.nombre}` : p.nombre
              }
              placeholderCerrado="Elegí un producto…"
              placeholderBuscar="Buscar por nombre o código…"
              inputClassName={INPUT}
            />
          </div>

          <div className="space-y-1 min-w-0">
            <label className={LABEL}>Empresa / Cliente</label>
            <ClienteSearchSelect
              clientes={clientes}
              value={clienteId}
              onChange={setClienteId}
              loading={clientesSelectLoading}
              inputClassName={INPUT}
            />
          </div>

          <div className="space-y-1 min-w-0 sm:col-span-2">
            <label className={LABEL}>Depósito</label>
            <select
              value={depositoId}
              onChange={(e) => setDepositoId(e.target.value)}
              className={INPUT}
            >
              <option value="">Elegí un depósito…</option>
              {depositos.map((d) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {(productoId && clienteId && depositoId) && (
          <div className="rounded border border-black/10 bg-vialto-mist/40 px-4 py-3 text-sm">
            {stockLoading ? (
              <span className="text-vialto-steel">Verificando stock…</span>
            ) : stockDisponible ? (
              <span className="text-vialto-charcoal">
                Stock disponible — {productoSeleccionado?.unidad1Nombre ?? 'Pallets'}: <strong>{stockDisponible.cantidad1}</strong>
                {(productoSeleccionado === null || productoSeleccionado.unidad2Nombre !== null) && (
                  <> · {productoSeleccionado?.unidad2Nombre ?? 'Unidad'}: <strong>{stockDisponible.cantidad2}</strong></>
                )}
              </span>
            ) : (
              <span className="text-vialto-steel">Sin stock registrado para esta combinación.</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">Origen (resta)</p>
            <div className="space-y-1">
              <label className={LABEL}>{productoSeleccionado?.unidad1Nombre ?? 'Pallets'} a restar</label>
              <input
                type="number"
                min="0"
                step="any"
                value={cantidad1Origen}
                onChange={(e) => setPalletsOrigen(e.target.value)}
                className={INPUT}
                placeholder="0"
              />
            </div>
            {(productoSeleccionado === null || productoSeleccionado.unidad2Nombre !== null) && (
              <div className="space-y-1">
                <label className={LABEL}>{productoSeleccionado?.unidad2Nombre ?? 'Unidad'} a restar</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cantidad2Origen}
                  onChange={(e) => setSueltoOrigen(e.target.value)}
                  className={INPUT}
                  placeholder="0"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">Destino (suma)</p>
            <div className="space-y-1">
              <label className={LABEL}>{productoSeleccionado?.unidad1Nombre ?? 'Pallets'} a sumar</label>
              <input
                type="number"
                min="0"
                step="any"
                value={cantidad1Destino}
                onChange={(e) => setPalletsDestino(e.target.value)}
                className={INPUT}
                placeholder="0"
              />
            </div>
            {(productoSeleccionado === null || productoSeleccionado.unidad2Nombre !== null) && (
              <div className="space-y-1">
                <label className={LABEL}>{productoSeleccionado?.unidad2Nombre ?? 'Unidad'} a sumar</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cantidad2Destino}
                  onChange={(e) => setSueltoDestino(e.target.value)}
                  className={INPUT}
                  placeholder="0"
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1">
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
        </div>

        <div className="space-y-1">
          <label className={LABEL}>Observaciones — opcional</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            className="w-full border border-black/15 bg-white px-2 py-1.5 text-sm resize-none"
            placeholder="Notas internas…"
          />
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-vialto-fire text-white text-sm font-semibold rounded hover:bg-vialto-fire/90 transition-colors disabled:opacity-50"
          >
            {saving && <Spinner />}
            {saving ? 'Guardando…' : 'Registrar división'}
          </button>
        </div>
      </form>
      {ayudaAbierta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAyudaAbierta(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ayuda-titulo"
            className="w-full max-w-md rounded border border-black/10 bg-white shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <h2 id="ayuda-titulo" className="text-base font-semibold text-vialto-charcoal">
                ¿Cómo funciona la división?
              </h2>
              <button
                type="button"
                onClick={() => setAyudaAbierta(false)}
                className="text-vialto-steel hover:text-vialto-charcoal transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4 text-sm text-vialto-charcoal">
              <p>
                Usá una división cuando la mercadería <strong>no entra ni sale del depósito</strong>,
                sino que cambia de presentación. Por ejemplo: tenías 2 pallets y los abriste
                en 48 unidades sueltas.
              </p>

              <div className="rounded bg-vialto-mist/60 px-3 py-2.5 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-vialto-steel">Ejemplo</p>
                <p>Origen → <strong>2 Pallets</strong> (lo que se deshace)</p>
                <p>Destino → <strong>48 Unidades</strong> (lo que queda en su lugar)</p>
              </div>

              <p className="text-vialto-steel">
                El sistema registra los dos movimientos juntos y los vincula en el historial,
                para que quede claro que fue una conversión interna y no una salida real.
              </p>

              <div className="space-y-1.5">
                <p className="font-semibold text-vialto-steel uppercase tracking-wide text-xs">Pasos</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Elegí el producto y la empresa.</li>
                  <li>En <strong>Origen</strong>, poné lo que se resta.</li>
                  <li>En <strong>Destino</strong>, poné lo que se suma.</li>
                  <li>Confirmá la fecha y guardá.</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end border-t border-black/10 px-5 py-3">
              <button
                type="button"
                onClick={() => setAyudaAbierta(false)}
                className="px-4 py-1.5 text-sm font-medium rounded border border-black/15 hover:bg-vialto-mist/60 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
