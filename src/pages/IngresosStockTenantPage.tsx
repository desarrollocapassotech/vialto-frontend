import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { ProductoModal } from '@/components/stock/ProductoModal';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import type { Cliente, Producto } from '@/types/api';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productosLoading, setProductosLoading] = useState(true);

  const [productoId, setProductoId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [cantidadPallets, setCantidadPallets] = useState('');
  const [cantidadSuelto, setCantidadSuelto] = useState('');
  const partesInicial = isoToFechaHora(new Date().toISOString());
  const [fechaMov, setFechaMov] = useState(partesInicial.fecha);
  const [horaMov, setHoraMov] = useState(partesInicial.hora);
  const [fechaMovError, setFechaMovError] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalProducto, setModalProducto] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccess(false);

    if (!productoId) return setFormError('Seleccioná un producto.');
    if (!clienteId) return setFormError('Seleccioná una empresa/cliente.');

    const pallets = parseFloat(cantidadPallets) || 0;
    const suelto = parseFloat(cantidadSuelto) || 0;
    if (pallets <= 0 && suelto <= 0) {
      return setFormError('Ingresá al menos una cantidad (Pallets o Suelto) mayor a 0.');
    }
    if (pallets < 0 || suelto < 0) {
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
        fecha: fechaIso,
      };
      if (pallets > 0) body.cantidadPallets = pallets;
      if (suelto > 0) body.cantidadSuelto = suelto;
      if (observaciones.trim()) body.observaciones = observaciones.trim();

      await apiJson(ingresosUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSuccess(true);
      setProductoId('');
      setClienteId('');
      setCantidadPallets('');
      setCantidadSuelto('');
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
            <label className={LABEL}>Producto</label>
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
              onNuevo={() => setModalProducto(true)}
              onNuevoLabel="+ Agregar producto"
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

          <div className="space-y-1 min-w-0">
            <label className={LABEL}>Pallets</label>
            <input
              type="number"
              min="0"
              step="any"
              value={cantidadPallets}
              onChange={(e) => setCantidadPallets(e.target.value)}
              className={INPUT}
              placeholder="0"
            />
          </div>

          <div className="space-y-1 min-w-0">
            <label className={LABEL}>Suelto</label>
            <input
              type="number"
              min="0"
              step="any"
              value={cantidadSuelto}
              onChange={(e) => setCantidadSuelto(e.target.value)}
              className={INPUT}
              placeholder="0"
            />
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
    </div>
  );
}
