import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/lib/toast';
import { Spinner } from '@/components/ui/Spinner';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { ProductoModal } from '@/components/stock/ProductoModal';
import { ClienteModal } from '@/components/viajes/ClienteModal';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import type { Cliente, Deposito, MovimientoStock, Producto, StockItem } from '@/types/api';
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

export function EgresosStockTenantPage({
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
  const [sessionClientes, setSessionClientes] = useState<Cliente[]>([]);
  const clientes = useMemo(() => {
    const base = clientesExternos ?? maestro.clientes;
    const ids = new Set(base.map((c) => c.id));
    return [...base, ...sessionClientes.filter((c) => !ids.has(c.id))];
  }, [clientesExternos, maestro.clientes, sessionClientes]);
  const clientesSelectLoading = platform ? Boolean(clientesExternosLoading) : maestro.loading;
  const productosBase = platform ? '/api/platform/stock/productos' : '/api/stock/productos';
  const egresosUrl = platform
    ? `/api/platform/stock/egresos${buildQs({}, tenantId)}`
    : '/api/stock/egresos';
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
  const [cantidad1, setCantidadPallets] = useState('');
  const [cantidad2, setCantidadSuelto] = useState('');
  const partesInicial = isoToFechaHora(new Date().toISOString());
  const [fechaMov, setFechaMov] = useState(partesInicial.fecha);
  const [horaMov, setHoraMov] = useState(partesInicial.hora);
  const [fechaMovError, setFechaMovError] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [remitoEscaneadoUrl, setRemitoEscaneadoUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalProducto, setModalProducto] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);
  const [stockDisponible, setStockDisponible] = useState<{ pallets: number; suelto: number } | null>(null);

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
    void (async () => {
      try {
        const qs = buildQs({ clienteId, productoId, depositoId }, tenantId);
        const data = await apiJson<StockItem[]>(`${disponibleBase}${qs}`, () => getToken());
        const row = data.find(
          (s) => s.productoId === productoId && s.clienteId === clienteId && s.depositoId === depositoId,
        );
        setStockDisponible(
          row
            ? { pallets: row.cantidad1, suelto: row.cantidad2 }
            : { pallets: 0, suelto: 0 },
        );
      } catch {
        setStockDisponible(null);
      }
    })();
  }, [productoId, clienteId, depositoId, disponibleBase, tenantId, getToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!productoId) return setFormError('Seleccioná un producto.');
    if (!clienteId) return setFormError('Seleccioná una empresa/cliente.');
    if (!depositoId) return setFormError('Seleccioná un depósito.');

    const pallets = parseFloat(cantidad1) || 0;
    const suelto = parseFloat(cantidad2) || 0;
    const u1 = productoSeleccionado?.unidad1Nombre ?? 'Pallets';
    const u2 = productoSeleccionado?.unidad2Nombre ?? null;
    if (pallets <= 0 && (u2 === null || suelto <= 0)) {
      return setFormError(`Ingresá al menos una cantidad (${u1}${u2 ? ` o ${u2}` : ''}) mayor a 0.`);
    }
    if (pallets < 0 || suelto < 0) {
      return setFormError('Las cantidades no pueden ser negativas.');
    }

    if (stockDisponible !== null) {
      if (pallets > 0 && pallets > stockDisponible.pallets) {
        return setFormError(
          `No podés egresar más ${u1.toLowerCase()} de los disponibles. Stock disponible: ${stockDisponible.pallets} ${u1.toLowerCase()}.`,
        );
      }
      if (u2 !== null && suelto > 0 && suelto > stockDisponible.suelto) {
        return setFormError(
          `No podés egresar más ${u2.toLowerCase()} del disponible. Stock disponible: ${stockDisponible.suelto} ${u2.toLowerCase()}.`,
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
        depositoId,
        fecha: fechaIso,
      };
      if (pallets > 0) payload.cantidad1 = pallets;
      if (suelto > 0) payload.cantidad2 = suelto;
      if (observaciones.trim()) payload.observaciones = observaciones.trim();
      if (remitoEscaneadoUrl.trim()) payload.remitoEscaneadoUrl = remitoEscaneadoUrl.trim();

      const created = await apiJson<MovimientoStock>(egresosUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast(
        created.numeroRemito
          ? `Egreso registrado — remito ${created.numeroRemito}`
          : 'Egreso registrado correctamente.',
      );
      setProductoId('');
      setProductoSeleccionado(null);
      setClienteId('');
      setDepositoId('');
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

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-black/10 p-6 space-y-5">
        <h2 className="text-base font-semibold text-vialto-charcoal">Nuevo egreso</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={LABEL}>Producto</label>
            <SearchableEntitySelect<Producto>
              items={productos}
              value={productoId}
              onChange={(id) => {
                setProductoId(id);
                setProductoSeleccionado(productos.find((p) => p.id === id) ?? null);
                setCantidadPallets('');
                setCantidadSuelto('');
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
              onNuevo={() => setModalCliente(true)}
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

          <div className="space-y-1 min-w-0">
            <label className={LABEL}>{productoSeleccionado?.unidad1Nombre ?? 'Pallets'}</label>
            <input
              type="number"
              min="0"
              step="any"
              value={cantidad1}
              onChange={(e) => setCantidadPallets(e.target.value)}
              className={INPUT}
              placeholder="0"
            />
            {stockDisponible !== null && productoId && clienteId && depositoId && (
              <p className="text-xs text-vialto-steel mt-1">
                Disponible: <span className="font-semibold text-vialto-charcoal">{stockDisponible.pallets}</span>{' '}
                {productoSeleccionado?.unidad1Nombre ?? 'pallets'}
              </p>
            )}
          </div>

          {(productoSeleccionado === null || productoSeleccionado.unidad2Nombre !== null) && (
            <div className="space-y-1 min-w-0">
              <label className={LABEL}>{productoSeleccionado?.unidad2Nombre ?? 'Unidad'}</label>
              <input
                type="number"
                min="0"
                step="any"
                value={cantidad2}
                onChange={(e) => setCantidadSuelto(e.target.value)}
                className={INPUT}
                placeholder="0"
              />
              {stockDisponible !== null && productoId && clienteId && depositoId && (
                <p className="text-xs text-vialto-steel mt-1">
                  Disponible: <span className="font-semibold text-vialto-charcoal">{stockDisponible.suelto}</span>{' '}
                  {productoSeleccionado?.unidad2Nombre ?? 'unidades'}
                </p>
              )}
            </div>
          )}

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

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-vialto-fire text-white text-sm font-semibold rounded hover:bg-vialto-fire/90 transition-colors disabled:opacity-50"
          >
            {saving && <Spinner />}
            {saving ? 'Guardando…' : 'Registrar egreso'}
          </button>
        </div>
      </form>

      {modalCliente && (
        <ClienteModal
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => setModalCliente(false)}
          onSaved={(c) => {
            setSessionClientes((prev) => [...prev, c]);
            setClienteId(c.id);
            setModalCliente(false);
            if (!tenantId) void maestro.refreshClientes();
          }}
        />
      )}

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
