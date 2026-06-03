import { useAuth, useUser } from '@clerk/clerk-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { ProductoModal } from '@/components/stock/ProductoModal';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import type { Cliente, MovimientoStock, Producto, StockEgresoRemitoConfig, StockItem } from '@/types/api';
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
  clientesExternosLoading,
}: {
  tenantId?: string;
  clientesExternos?: Cliente[];
  clientesExternosLoading?: boolean;
}) {
  const { getToken, orgRole } = useAuth();
  const { user } = useUser();
  const maestro = useMaestroData();
  const clientes = clientesExternos ?? maestro.clientes;
  const platform = Boolean(tenantId);
  const clientesSelectLoading = platform ? Boolean(clientesExternosLoading) : maestro.loading;
  const puedeGestionar = puedeGestionarComoAdminEmpresa(orgRole, user?.publicMetadata);
  const puedeEditarFormatoRemito = Boolean(tenantId) || puedeGestionar;
  const productosBase = platform ? '/api/platform/stock/productos' : '/api/stock/productos';
  const egresosUrl = platform
    ? `/api/platform/stock/egresos${buildQs({}, tenantId)}`
    : '/api/stock/egresos';
  const disponibleBase = platform ? '/api/platform/stock/disponible' : '/api/stock/disponible';
  const remitoConfigUrl = platform
    ? `/api/platform/stock/egresos/remito-config${buildQs({}, tenantId)}`
    : '/api/stock/egresos/remito-config';

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
  const [remitoEscaneadoUrl, setRemitoEscaneadoUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalProducto, setModalProducto] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ultimoRemito, setUltimoRemito] = useState<string | null>(null);
  const [stockDisponible, setStockDisponible] = useState<{ pallets: number; suelto: number } | null>(null);
  const [remitoConfig, setRemitoConfig] = useState<StockEgresoRemitoConfig | null>(null);
  const [configDraft, setConfigDraft] = useState({ remitoPrefix: 'R', remitoDigitos: 5 });
  const [configSaving, setConfigSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

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
    if (!productoId || !clienteId) {
      setStockDisponible(null);
      return;
    }
    void (async () => {
      try {
        const qs = buildQs({ clienteId, productoId }, tenantId);
        const data = await apiJson<StockItem[]>(`${disponibleBase}${qs}`, () => getToken());
        const row = data.find((s) => s.productoId === productoId && s.clienteId === clienteId);
        setStockDisponible(
          row
            ? { pallets: row.cantidadPallets, suelto: row.cantidadSuelto }
            : { pallets: 0, suelto: 0 },
        );
      } catch {
        setStockDisponible(null);
      }
    })();
  }, [productoId, clienteId, disponibleBase, tenantId, getToken]);

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
    if (!clienteId) return setFormError('Seleccioná una empresa/cliente.');

    const pallets = parseFloat(cantidadPallets) || 0;
    const suelto = parseFloat(cantidadSuelto) || 0;
    if (pallets <= 0 && suelto <= 0) {
      return setFormError('Ingresá al menos una cantidad (Pallets o Suelto) mayor a 0.');
    }
    if (pallets < 0 || suelto < 0) {
      return setFormError('Las cantidades no pueden ser negativas.');
    }

    if (stockDisponible !== null) {
      if (pallets > 0 && pallets > stockDisponible.pallets) {
        return setFormError(
          `No podés egresar más pallets de los disponibles. Stock disponible: ${stockDisponible.pallets} pallets.`,
        );
      }
      if (suelto > 0 && suelto > stockDisponible.suelto) {
        return setFormError(
          `No podés egresar más suelto del disponible. Stock disponible: ${stockDisponible.suelto} unidades sueltas.`,
        );
      }
    }

    const fmError = !fechaMov.trim() ? 'Ingresá la fecha del movimiento.' : null;
    setFechaMovError(fmError);
    if (fmError) return setFormError(fmError);

    const fechaIso = fechaHoraToIso(fechaMov, horaMov);
    if (!fechaIso) return setFormError('Revisá la fecha y hora del movimiento.');

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        productoId,
        clienteId,
        fecha: fechaIso,
      };
      if (pallets > 0) payload.cantidadPallets = pallets;
      if (suelto > 0) payload.cantidadSuelto = suelto;
      if (observaciones.trim()) payload.observaciones = observaciones.trim();
      if (remitoEscaneadoUrl.trim()) payload.remitoEscaneadoUrl = remitoEscaneadoUrl.trim();

      const created = await apiJson<MovimientoStock>(egresosUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSuccess(true);
      setUltimoRemito(created.numeroRemito ?? null);
      setProductoId('');
      setClienteId('');
      setCantidadPallets('');
      setCantidadSuelto('');
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
            {stockDisponible !== null && productoId && clienteId && (
              <p className="text-xs text-vialto-steel mt-1">
                Disponible: <span className="font-semibold text-vialto-charcoal">{stockDisponible.pallets}</span> pallets
              </p>
            )}
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
            {stockDisponible !== null && productoId && clienteId && (
              <p className="text-xs text-vialto-steel mt-1">
                Disponible: <span className="font-semibold text-vialto-charcoal">{stockDisponible.suelto}</span> unidades
              </p>
            )}
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
          <p className="text-sm text-red-800">
            Egreso registrado correctamente
            {ultimoRemito ? (
              <>
                {' '}
                — remito{' '}
                <span className="font-mono font-semibold text-vialto-charcoal">{ultimoRemito}</span>
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
    </div>
  );
}
