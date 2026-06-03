import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { ProductoModal } from '@/components/stock/ProductoModal';
import { PresentacionesModal } from '@/components/stock/PresentacionesModal';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import type { Cliente, Presentacion, Producto } from '@/types/api';
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

export function IngresosStockTenantPage({
  tenantId,
  clientesExternos,
  clientesExternosLoading,
}: {
  tenantId?: string;
  clientesExternos?: Cliente[];
  /** Solo con `tenantId` (plataforma): true mientras llegan los clientes de la empresa. */
  clientesExternosLoading?: boolean;
}) {
  const { getToken } = useAuth();
  const maestro = useMaestroData();
  const clientes = clientesExternos ?? maestro.clientes;
  const platform = Boolean(tenantId);
  const clientesSelectLoading = platform ? Boolean(clientesExternosLoading) : maestro.loading;
  const productosBase = platform ? '/api/platform/stock/productos' : '/api/stock/productos';
  const ingresosUrl = platform
    ? `/api/platform/stock/ingresos${buildQs({}, tenantId)}`
    : '/api/stock/ingresos';

  const [productos, setProductos] = useState<Producto[]>([]);
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productosLoading, setProductosLoading] = useState(true);

  const [productoId, setProductoId] = useState('');
  const [presentacionId, setPresentacionId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const partesInicial = isoToFechaHora(new Date().toISOString());
  const [fechaMov, setFechaMov] = useState(partesInicial.fecha);
  const [horaMov, setHoraMov] = useState(partesInicial.hora);
  const [fechaMovError, setFechaMovError] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalProducto, setModalProducto] = useState(false);
  const [modalPresentacion, setModalPresentacion] = useState(false);
  const [success, setSuccess] = useState(false);

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
    if (!productoId) {
      setPresentaciones([]);
      setPresentacionId('');
      return;
    }
    void (async () => {
      try {
        const url = `${productosBase}/${encodeURIComponent(productoId)}/presentaciones${buildQs({}, tenantId)}`;
        const data = await apiJson<Presentacion[]>(url, () => getToken());
        setPresentaciones(data);
        setPresentacionId('');
      } catch {
        setPresentaciones([]);
        setPresentacionId('');
      }
    })();
  }, [productoId, productosBase, tenantId, getToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccess(false);

    if (!productoId) return setFormError('Seleccioná un producto.');
    if (!presentacionId) return setFormError('Seleccioná una presentación.');
    if (!clienteId) return setFormError('Seleccioná una empresa/cliente.');
    const cantNum = parseFloat(cantidad);
    if (!cantidad || isNaN(cantNum) || cantNum <= 0)
      return setFormError('La cantidad debe ser mayor a 0.');
    const fmError = !fechaMov.trim() ? 'Ingresá la fecha del movimiento.' : null;
    setFechaMovError(fmError);
    if (fmError) return setFormError(fmError);

    const fechaIso = fechaHoraToIso(fechaMov, horaMov);
    if (!fechaIso) return setFormError('Revisá la fecha y hora del movimiento.');

    setSaving(true);
    try {
      await apiJson(ingresosUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          productoId,
          presentacionId,
          clienteId,
          cantidad: cantNum,
          fecha: fechaIso,
          ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
        }),
      });
      setSuccess(true);
      setProductoId('');
      setPresentacionId('');
      setClienteId('');
      setCantidad('');
      const p = isoToFechaHora(new Date().toISOString());
      setFechaMov(p.fecha);
      setHoraMov(p.hora);
      setFechaMovError(null);
      setObservaciones('');
    } catch (e) {
      setFormError(friendlyError(e, 'stock'));
    } finally {
      setSaving(false);
    }
  }

  const productoActual = productos.find((p) => p.id === productoId) ?? null;

  const historialHref = platform
    ? `/stock/ingresos/historial?tenantId=${encodeURIComponent(tenantId!)}`
    : '/stock/ingresos/historial';

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {!platform && (
        <div>
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Ingresos al depósito</h1>
          <p className="mt-1 text-sm text-vialto-steel">
            Registrá mercadería entrante. El stock se actualiza de forma automática al guardar.
          </p>
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
        <h2 className="text-base font-semibold text-vialto-charcoal">Nuevo ingreso</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className={LABEL}>Producto</label>
              <button
                type="button"
                onClick={() => setModalProducto(true)}
                disabled={productosLoading}
                className="text-xs text-vialto-fire hover:underline font-medium disabled:opacity-40 disabled:pointer-events-none"
              >
                + Agregar producto
              </button>
            </div>
            <SearchableEntitySelect<Producto>
              items={productos}
              value={productoId}
              onChange={setProductoId}
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
              getSecondaryLabel={(p) => p.unidadMedida ?? undefined}
              placeholderCerrado="Elegí un producto…"
              placeholderBuscar="Buscar por nombre o código…"
              inputClassName={INPUT}
              noItemsSlot={
                <div className="space-y-2">
                  <div className={`${INPUT} flex items-center text-vialto-steel`}>
                    Sin productos en el catálogo
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalProducto(true)}
                    className="h-8 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
                  >
                    Crear primer producto
                  </button>
                </div>
              }
            />
          </div>

          <div className="space-y-1">
            <label className={LABEL}>Presentación</label>
            {!productoId ? (
              <div className={`${INPUT} flex items-center text-vialto-steel/60 cursor-not-allowed`}>
                Primero elegí un producto
              </div>
            ) : presentaciones.length === 0 ? (
              <div className="space-y-2">
                <div className={`${INPUT} flex items-center text-amber-700`}>
                  Este producto no tiene presentaciones
                </div>
                <button
                  type="button"
                  onClick={() => setModalPresentacion(true)}
                  className="h-8 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite"
                >
                  + Agregar presentación
                </button>
              </div>
            ) : (
              <SearchableEntitySelect<Presentacion>
                items={presentaciones}
                value={presentacionId}
                onChange={setPresentacionId}
                filterItems={(items, q) =>
                  items.filter((p) => p.nombre.toLowerCase().includes(q.toLowerCase()))
                }
                getPrimaryLabel={(p) => p.nombre}
                placeholderCerrado="Elegí una presentación…"
                placeholderBuscar="Buscar presentación…"
                inputClassName={INPUT}
                noItemsSlot={<div className={INPUT} />}
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:col-span-2">
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
            <div className="space-y-1 min-w-0">
              <label className={LABEL}>
                Cantidad{productoActual ? ` (${productoActual.unidadMedida ?? ''})` : ''}
              </label>
              <input
                type="number"
                min="0.001"
                step="any"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className={INPUT}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-1 sm:col-span-2">
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
        {success && (
          <p className="text-sm text-emerald-600">Ingreso registrado correctamente.</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-vialto-fire text-white text-sm font-semibold rounded hover:bg-vialto-fire/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Registrar ingreso'}
          </button>
        </div>
      </form>

      {modalProducto && (
        <ProductoModal
          modo="create"
          baseUrl={productosBase}
          tenantId={tenantId}
          getToken={getToken}
          onClose={() => setModalProducto(false)}
          onSaved={async (nuevo) => {
            setModalProducto(false);
            await loadProductos();
            setProductoId(nuevo.id);
          }}
        />
      )}

      {modalPresentacion && productoActual && (
        <PresentacionesModal
          producto={productoActual}
          baseUrl={productosBase}
          tenantId={tenantId}
          getToken={getToken}
          onClose={() => setModalPresentacion(false)}
          onPresentacionCreada={async (nueva) => {
            setModalPresentacion(false);
            // recargar presentaciones del producto actual
            const url = `${productosBase}/${encodeURIComponent(productoActual.id)}/presentaciones${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`;
            try {
              const data = await apiJson<Presentacion[]>(url, () => getToken());
              setPresentaciones(data);
            } catch { /* no-op */ }
            setPresentacionId(nueva.id);
          }}
        />
      )}
    </div>
  );
}
