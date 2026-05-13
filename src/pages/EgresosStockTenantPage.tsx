import { useAuth, useUser } from '@clerk/clerk-react';
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
import type { Cliente, MovimientoStock, Presentacion, Producto, StockEgresoRemitoConfig, StockItem } from '@/types/api';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';
import { puedeGestionarComoAdminEmpresa } from '@/lib/roleLabels';

type PaginatedProductos = { items: Producto[]; meta: unknown };

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

function buildQs(params: Record<string, string | number>, tenantId?: string): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  for (const [k, v] of Object.entries(params)) parts.push(`${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

export function EgresosStockTenantPage({
  tenantId,
  clientesExternos,
}: {
  tenantId?: string;
  clientesExternos?: Cliente[];
}) {
  const { getToken, orgRole } = useAuth();
  const { user } = useUser();
  const maestro = useMaestroData();
  const clientes = clientesExternos ?? maestro.clientes;
  const puedeGestionar = puedeGestionarComoAdminEmpresa(orgRole, user?.publicMetadata);
  const puedeEditarFormatoRemito = Boolean(tenantId) || puedeGestionar;

  const platform = Boolean(tenantId);
  const productosBase = platform ? '/api/platform/stock/productos' : '/api/stock/productos';
  const egresosUrl = platform
    ? `/api/platform/stock/egresos${buildQs({}, tenantId)}`
    : '/api/stock/egresos';
  const disponibleBase = platform ? '/api/platform/stock/disponible' : '/api/stock/disponible';
  const remitoConfigUrl = platform
    ? `/api/platform/stock/egresos/remito-config${buildQs({}, tenantId)}`
    : '/api/stock/egresos/remito-config';

  const [productos, setProductos] = useState<Producto[]>([]);
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [productoId, setProductoId] = useState('');
  const [presentacionId, setPresentacionId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const partesInicial = isoToFechaHora(new Date().toISOString());
  const [fechaMov, setFechaMov] = useState(partesInicial.fecha);
  const [horaMov, setHoraMov] = useState(partesInicial.hora);
  const [fechaMovError, setFechaMovError] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [remitoEscaneadoUrl, setRemitoEscaneadoUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalProducto, setModalProducto] = useState(false);
  const [modalPresentacion, setModalPresentacion] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ultimoRemito, setUltimoRemito] = useState<string | null>(null);
  const [stockDisponible, setStockDisponible] = useState<number | null>(null);
  const [remitoConfig, setRemitoConfig] = useState<StockEgresoRemitoConfig | null>(null);
  const [configDraft, setConfigDraft] = useState({ remitoPrefix: 'R', remitoDigitos: 5 });
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const loadProductos = useCallback(async () => {
    try {
      const url = `${productosBase}/paginated${buildQs({ page: 1, pageSize: 100, filtroActivo: 'activos' }, tenantId)}`;
      const data = await apiJson<PaginatedProductos>(url, () => getToken());
      setProductos(data.items);
    } catch (e) {
      setLoadError(friendlyError(e, 'stock'));
    }
  }, [productosBase, tenantId, getToken]);

  const loadRemitoConfig = useCallback(async () => {
    try {
      const c = await apiJson<StockEgresoRemitoConfig>(remitoConfigUrl, () => getToken());
      setRemitoConfig(c);
      setConfigDraft({ remitoPrefix: c.remitoPrefix, remitoDigitos: c.remitoDigitos });
    } catch {
      setRemitoConfig(null);
    }
  }, [remitoConfigUrl, getToken]);

  useEffect(() => {
    void loadProductos();
    void loadRemitoConfig();
  }, [loadProductos, loadRemitoConfig]);

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

  useEffect(() => {
    if (!productoId || !presentacionId || !clienteId) {
      setStockDisponible(null);
      return;
    }
    void (async () => {
      try {
        const qs = buildQs({ clienteId, productoId }, tenantId);
        const data = await apiJson<StockItem[]>(`${disponibleBase}${qs}`, () => getToken());
        const row = data.find((s) => s.presentacionId === presentacionId);
        setStockDisponible(row ? row.cantidad : 0);
      } catch {
        setStockDisponible(null);
      }
    })();
  }, [productoId, presentacionId, clienteId, disponibleBase, tenantId, getToken]);

  async function guardarRemitoConfig(e: React.FormEvent) {
    e.preventDefault();
    setConfigMsg(null);
    setConfigSaving(true);
    try {
      const method = 'PATCH';
      const body = JSON.stringify({
        remitoPrefix: configDraft.remitoPrefix.trim(),
        remitoDigitos: Number(configDraft.remitoDigitos),
      });
      const c = await apiJson<StockEgresoRemitoConfig>(remitoConfigUrl, () => getToken(), { method, body });
      setRemitoConfig(c);
      setConfigMsg('Formato actualizado.');
    } catch (e) {
      setConfigMsg(friendlyError(e, 'stock'));
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccess(false);
    setUltimoRemito(null);

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

    if (stockDisponible !== null && cantNum > stockDisponible) {
      return setFormError(
        `No podés egresar más de lo disponible para esta combinación. Stock disponible: ${stockDisponible}.`,
      );
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        productoId,
        presentacionId,
        clienteId,
        cantidad: cantNum,
        fecha: fechaIso,
      };
      if (observaciones.trim()) payload.observaciones = observaciones.trim();
      if (remitoEscaneadoUrl.trim()) payload.remitoEscaneadoUrl = remitoEscaneadoUrl.trim();

      const created = await apiJson<MovimientoStock>(egresosUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess(true);
      setUltimoRemito(created.numeroRemito ?? null);
      setProductoId('');
      setPresentacionId('');
      setClienteId('');
      setCantidad('');
      const p = isoToFechaHora(new Date().toISOString());
      setFechaMov(p.fecha);
      setHoraMov(p.hora);
      setFechaMovError(null);
      setObservaciones('');
      setRemitoEscaneadoUrl('');
    } catch (e) {
      setFormError(friendlyError(e, 'stock'));
    } finally {
      setSaving(false);
    }
  }

  const productoActual = productos.find((p) => p.id === productoId) ?? null;
  const ejemploYear =
    fechaMov.trim().length >= 4 ? parseInt(fechaMov.slice(0, 4), 10) : new Date().getFullYear();
  const formatoEjemplo =
    remitoConfig != null && !Number.isNaN(ejemploYear)
      ? `${remitoConfig.remitoPrefix}-${ejemploYear}-${String(1).padStart(remitoConfig.remitoDigitos, '0')}`
      : null;

  const historialHref = platform
    ? `/stock/egresos/historial?tenantId=${encodeURIComponent(tenantId!)}`
    : '/stock/egresos/historial';

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {!platform && (
        <div>
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Egresos / despacho</h1>
          <p className="mt-1 text-sm text-vialto-steel">
            Registrá salida de mercadería. Se asigna un número de remito interno y el stock se descuenta de forma
            atómica al guardar.
          </p>
        </div>
      )}

      {loadError && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
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

      {puedeEditarFormatoRemito && (
        <div className="rounded-lg border border-black/10 bg-white p-4">
          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            className="text-sm font-medium text-vialto-fire hover:underline"
          >
            {showConfig ? 'Ocultar formato del remito' : 'Formato del número de remito (prefijo y dígitos)'}
          </button>
          {showConfig && (
            <form onSubmit={guardarRemitoConfig} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className={LABEL}>Prefijo</label>
                <input
                  className={INPUT}
                  value={configDraft.remitoPrefix}
                  onChange={(e) => setConfigDraft((d) => ({ ...d, remitoPrefix: e.target.value }))}
                  maxLength={20}
                />
              </div>
              <div className="space-y-1">
                <label className={LABEL}>Dígitos del correlativo</label>
                <input
                  type="number"
                  min={3}
                  max={12}
                  className={INPUT}
                  value={configDraft.remitoDigitos}
                  onChange={(e) =>
                    setConfigDraft((d) => ({ ...d, remitoDigitos: Number(e.target.value) || 5 }))
                  }
                />
              </div>
              {configMsg && <p className="sm:col-span-2 text-sm text-vialto-steel">{configMsg}</p>}
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={configSaving}
                  className="px-4 py-2 text-sm font-semibold bg-vialto-charcoal text-white rounded hover:bg-vialto-graphite disabled:opacity-50"
                >
                  {configSaving ? 'Guardando…' : 'Guardar formato'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-black/10 p-6 space-y-5">
        <h2 className="text-base font-semibold text-vialto-charcoal">Nuevo egreso</h2>
        {formatoEjemplo && (
          <p className="text-xs text-vialto-steel">
            Ejemplo con el próximo correlativo: <span className="font-mono text-vialto-charcoal">{formatoEjemplo}</span>
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className={LABEL}>Producto</label>
              <button
                type="button"
                onClick={() => setModalProducto(true)}
                className="text-xs text-vialto-fire hover:underline font-medium"
              >
                + Agregar producto
              </button>
            </div>
            <SearchableEntitySelect<Producto>
              items={productos}
              value={productoId}
              onChange={setProductoId}
              filterItems={(items, q) =>
                items.filter((p) => p.nombre.toLowerCase().includes(q.toLowerCase()))
              }
              getPrimaryLabel={(p) => p.nombre}
              getSecondaryLabel={(p) => p.unidadMedida ?? undefined}
              placeholderCerrado="Elegí un producto…"
              placeholderBuscar="Buscar producto…"
              inputClassName={INPUT}
              noItemsSlot={
                <div className="space-y-2">
                  <div className={`${INPUT} flex items-center text-vialto-steel`}>Sin productos en el catálogo</div>
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
                <div className={`${INPUT} flex items-center text-amber-700`}>Este producto no tiene presentaciones</div>
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
              {stockDisponible !== null && productoId && presentacionId && clienteId && (
                <p className="text-xs text-vialto-steel mt-1">
                  Stock disponible (misma empresa, producto y presentación):{' '}
                  <span className="font-semibold text-vialto-charcoal">{stockDisponible}</span>
                </p>
              )}
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

        <div className="space-y-1">
          <label className={LABEL}>Remito escaneado (URL) — opcional</label>
          <input
            type="url"
            value={remitoEscaneadoUrl}
            onChange={(e) => setRemitoEscaneadoUrl(e.target.value)}
            className={INPUT}
            placeholder="https://… (se completará con subida a almacenamiento en una próxima tarea)"
          />
          <p className="text-xs text-vialto-steel">
            Por ahora podés pegar una URL pública si ya tenés el archivo hospedado. La subida directa desde acá se
            agregará después.
          </p>
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}
        {success && (
          <p className="text-sm text-emerald-600">
            Egreso registrado correctamente
            {ultimoRemito ? (
              <>
                {' '}
                — remito <span className="font-mono font-semibold">{ultimoRemito}</span>
              </>
            ) : null}
            .
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-vialto-fire text-white text-sm font-semibold rounded hover:bg-vialto-fire/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Registrar egreso'}
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
            const url = `${productosBase}/${encodeURIComponent(productoActual.id)}/presentaciones${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`;
            try {
              const data = await apiJson<Presentacion[]>(url, () => getToken());
              setPresentaciones(data);
            } catch {
              /* no-op */
            }
            setPresentacionId(nueva.id);
          }}
        />
      )}
    </div>
  );
}
