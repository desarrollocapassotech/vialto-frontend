import { useAuth, useUser } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/lib/toast';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { Spinner } from '@/components/ui/Spinner';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { ClienteSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { SearchableEntitySelect } from '@/components/forms/SearchableEntitySelect';
import { RemitoAdjuntoStock } from '@/components/stock/RemitoAdjuntoStock';
import { isRemitoAdjuntoFile, uploadStockRemitoPdf } from '@/lib/stockRemitoUpload';
import { ClienteModal } from '@/components/viajes/ClienteModal';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import type { Cliente, Deposito, Producto, ProductoPresentacion, StockItem } from '@/types/api';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';

type PaginatedProductos = { items: Producto[]; meta: unknown };
type EgresoResult = { id: string; numeroRemito: string | null; movimientosCount: number };

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

type EgresoRow = {
  _key: string;
  ProductoId: string;
  presentacionId: string;
  bultos: string;
  sueltas: string;
  lote: string;
};

function emptyRow(): EgresoRow {
  return {
    _key: crypto.randomUUID(),
    ProductoId: '',
    presentacionId: '',
    bultos: '',
    sueltas: '',
    lote: '',
  };
}

function buildQs(params: Record<string, string | number>, tenantId?: string): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  for (const [k, v] of Object.entries(params)) parts.push(`${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function getPresentaciones(Productos: Producto[], ProductoId: string): ProductoPresentacion[] {
  return Productos.find((p) => p.id === ProductoId)?.productoPresentaciones ?? [];
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
  const { user } = useUser();
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
  const ProductosBase = platform ? '/api/platform/stock/productos' : '/api/stock/productos';
  const egresosUrl = platform
    ? `/api/platform/stock/egresos${buildQs({}, tenantId)}`
    : '/api/stock/egresos';
  const disponibleBase = platform ? '/api/platform/stock/disponible' : '/api/stock/disponible';
  const depositosBase = platform ? '/api/platform/stock/depositos' : '/api/stock/depositos';

  const [Productos, setProductos] = useState<Producto[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ProductosLoading, setProductosLoading] = useState(true);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);

  // Header
  const [clienteId, setClienteId] = useState('');
  const [depositoId, setDepositoId] = useState('');
  const partesInicial = isoToFechaHora(new Date().toISOString());
  const [fechaMov, setFechaMov] = useState(partesInicial.fecha);
  const [horaMov, setHoraMov] = useState(partesInicial.hora);
  const [fechaMovError, setFechaMovError] = useState<string | null>(null);
  const [entregadoPor, setEntregadoPor] = useState('');
  const [destinatario, setDestinatario] = useState('');
  const [destinoFinal, setDestinoFinal] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [remitoFile, setRemitoFile] = useState<File | null>(null);

  // Líneas
  const [rows, setRows] = useState<EgresoRow[]>([emptyRow()]);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);

  // Pre-completar conductor con el nombre del usuario logueado
  useEffect(() => {
    if (!user) return;
    const nombre = user.fullName?.trim() || user.firstName?.trim() || '';
    setEntregadoPor((prev) => prev || nombre);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProductos = useCallback(async () => {
    setProductosLoading(true);
    setLoadError(null);
    try {
      const url = `${ProductosBase}/paginated${buildQs({ page: 1, pageSize: 200, filtroActivo: 'activos' }, tenantId)}`;
      const data = await apiJson<PaginatedProductos>(url, () => getToken());
      setProductos(data.items);
    } catch (e) {
      setLoadError(friendlyError(e, 'stock'));
    } finally {
      setProductosLoading(false);
    }
  }, [ProductosBase, tenantId, getToken]);

  useEffect(() => { void loadProductos(); }, [loadProductos]);

  useEffect(() => {
    const url = `${depositosBase}${buildQs({ activo: '1' }, tenantId)}`;
    void apiJson<Deposito[]>(url, () => getToken())
      .then(setDepositos)
      .catch(() => setDepositos([]));
  }, [depositosBase, tenantId, getToken]);

  // Cargar stock disponible cuando cambian cliente o depósito
  useEffect(() => {
    if (!clienteId || !depositoId) {
      setStockItems([]);
      return;
    }
    void apiJson<StockItem[]>(
      `${disponibleBase}${buildQs({ clienteId, depositoId }, tenantId)}`,
      () => getToken(),
    )
      .then(setStockItems)
      .catch(() => setStockItems([]));
  }, [clienteId, depositoId, disponibleBase, tenantId, getToken]);

  function getDisponible(ProductoId: string, presentacionId: string): StockItem | null {
    if (!ProductoId || !presentacionId) return null;
    return (
      stockItems.find(
        (s) => s.productoId === ProductoId && s.presentacionId === presentacionId,
      ) ?? null
    );
  }

  function updateRow(key: string, patch: Partial<EgresoRow>) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r._key !== key));
  }

  function resetForm() {
    setClienteId('');
    setDepositoId('');
    const p = isoToFechaHora(new Date().toISOString());
    setFechaMov(p.fecha);
    setHoraMov(p.hora);
    setFechaMovError(null);
    setEntregadoPor('');
    setDestinatario('');
    setDestinoFinal('');
    setObservaciones('');
    setRemitoFile(null);
    setRows([emptyRow()]);
    setStockItems([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const ferrs: Record<string, string> = {};
    if (!clienteId) ferrs.clienteId = 'Seleccioná una empresa/cliente.';
    if (!depositoId) ferrs.depositoId = 'Seleccioná un depósito.';

    rows.forEach((row, idx) => {
      if (!row.ProductoId) ferrs[`row_${idx}_ProductoId`] = 'Seleccioná un Producto.';
      if (!row.presentacionId) ferrs[`row_${idx}_presentacionId`] = 'Seleccioná una presentación.';
      const b = parseFloat(row.bultos) || 0;
      const s = parseFloat(row.sueltas) || 0;
      if (b <= 0 && s <= 0) {
        ferrs[`row_${idx}_bultos`] = 'Ingresá bultos o sueltas mayor a 0.';
      } else if (row.ProductoId && row.presentacionId && clienteId && depositoId) {
        const disponible = getDisponible(row.ProductoId, row.presentacionId);
        const dispBultos = disponible?.cantidad1 ?? 0;
        const dispSueltas = disponible?.cantidad2 ?? 0;
        if (b > dispBultos) {
          ferrs[`row_${idx}_bultos`] = `Stock insuficiente. Disponible: ${dispBultos} bultos.`;
        }
        if (s > dispSueltas) {
          ferrs[`row_${idx}_sueltas`] = `Stock insuficiente. Disponible: ${dispSueltas} sueltas.`;
        }
      }
    });

    if (Object.keys(ferrs).length > 0) {
      setFieldErrors(ferrs);
      setFormError('Revisá los campos marcados en rojo.');
      return;
    }
    setFieldErrors({});

    const fmError = !fechaMov.trim() ? 'Ingresá la fecha del movimiento.' : null;
    setFechaMovError(fmError);
    if (fmError) return setFormError(fmError);

    const fechaIso = fechaHoraToIso(fechaMov, horaMov);
    if (!fechaIso) return setFormError('Revisá la fecha y hora del movimiento.');

    if (!remitoFile) return setFormError('Cargá el remito antes de registrar el egreso.');
    if (!isRemitoAdjuntoFile(remitoFile)) {
      return setFormError('El remito debe ser un PDF o una imagen (foto).');
    }

    setSaving(true);
    try {
      const remitoEscaneadoUrl = await uploadStockRemitoPdf(getToken, remitoFile, tenantId);

      const body = {
        clienteId,
        depositoId,
        fecha: fechaIso,
        remitoEscaneadoUrl,
        entregadoPor: entregadoPor.trim() || undefined,
        destinatario: destinatario.trim() || undefined,
        destinoFinal: destinoFinal.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        lineas: rows.map((row) => ({
          productoId: row.ProductoId,
          presentacionId: row.presentacionId,
          bultos: parseFloat(row.bultos) || 0,
          sueltas: parseFloat(row.sueltas) || 0,
          lote: row.lote.trim() || undefined,
        })),
      };

      const result = await apiJson<EgresoResult>(egresosUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify(body),
      });

      showToast(
        result.numeroRemito
          ? `Egreso registrado — remito ${result.numeroRemito}`
          : 'Egreso registrado correctamente.',
      );
      resetForm();
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
    <div className="max-w-4xl mx-auto space-y-8">
      {!platform && (
        <div>
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Egresos / despacho</h1>
          <p className="mt-1 text-sm text-vialto-steel">
            Registrá salida de mercadería. Se genera un número de remito interno y el stock se
            descuenta de forma atómica al guardar.
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* â”€â”€ CABECERA â”€â”€ */}
        <div className="bg-white rounded-lg border border-black/10 p-6 space-y-5">
          <h2 className="text-base font-semibold text-vialto-charcoal">Datos del egreso</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 min-w-0">
              <label className={LABEL}>Empresa / Cliente <span className="text-red-500">*</span></label>
              <ClienteSearchSelect
                clientes={clientes}
                value={clienteId}
                onChange={(id) => {
                  setClienteId(id);
                  setStockItems([]);
                }}
                loading={clientesSelectLoading}
                inputClassName={INPUT}
                onNuevo={() => setModalCliente(true)}
              />
              <CrudFieldError message={fieldErrors.clienteId} />
            </div>

            <div className="space-y-1 min-w-0">
              <label className={LABEL}>Depósito <span className="text-red-500">*</span></label>
              <select
                value={depositoId}
                onChange={(e) => {
                  setDepositoId(e.target.value);
                  setStockItems([]);
                }}
                className={`h-9 w-full border bg-white px-2 text-sm ${fieldErrors.depositoId ? 'border-red-400' : 'border-black/15'}`}
              >
                <option value="">Elegí un depósito…</option>
                {depositos.map((d) => (
                  <option key={d.id} value={d.id}>{d.nombre}</option>
                ))}
              </select>
              <CrudFieldError message={fieldErrors.depositoId} />
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

            <div className="space-y-1">
              <label className={LABEL}>Conductor</label>
              <input
                type="text"
                value={entregadoPor}
                onChange={(e) => setEntregadoPor(e.target.value)}
                className={INPUT}
                placeholder="Ej: Cacho, Gustavo…"
                maxLength={200}
              />
            </div>

            <div className="space-y-1">
              <label className={LABEL}>Destinatario</label>
              <input
                type="text"
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                className={INPUT}
                placeholder="Ej: Luvi SRL, Myca SRL…"
                maxLength={200}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className={LABEL}>Dirección / Ruta de entrega</label>
              <input
                type="text"
                value={destinoFinal}
                onChange={(e) => setDestinoFinal(e.target.value)}
                className={INPUT}
                placeholder="Ej: Express Brio, Pampa 1087 San Fernando…"
                maxLength={300}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className={LABEL}>Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="w-full border border-black/15 bg-white px-2 py-1.5 text-sm resize-none"
              placeholder="Notas internas…"
            />
          </div>

          <RemitoAdjuntoStock
            file={remitoFile}
            onFileChange={setRemitoFile}
            labelClassName={LABEL}
            disabled={saving}
          />
        </div>

        {/* â”€â”€ LÃNEAS â”€â”€ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-vialto-charcoal">
              Productos <span className="ml-1 text-sm font-normal text-vialto-steel">({rows.length})</span>
            </h2>
            <button
              type="button"
              onClick={addRow}
              className="text-sm font-medium text-vialto-charcoal border border-black/15 bg-white px-3 py-1.5 rounded hover:bg-vialto-mist/60 transition-colors"
            >
              + Agregar línea
            </button>
          </div>

          {(!clienteId || !depositoId) && (
            <p className="text-xs text-vialto-steel italic">
              Seleccioná cliente y depósito para ver el stock disponible por línea.
            </p>
          )}

          {rows.map((row, idx) => {
            const pps = getPresentaciones(Productos, row.ProductoId);
            const selectedPP = pps.find((pp) => pp.id === row.presentacionId);
            const disponible = getDisponible(row.ProductoId, row.presentacionId);

            return (
              <div key={row._key} className="bg-white rounded-lg border border-black/10 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`${LABEL} text-xs`}>Línea {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeRow(row._key)}
                    disabled={rows.length <= 1}
                    className="text-xs text-red-600 hover:underline disabled:opacity-30 disabled:no-underline"
                  >
                    Eliminar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Producto */}
                  <div className="space-y-1">
                    <label className={LABEL}>Producto <span className="text-red-500">*</span></label>
                    <SearchableEntitySelect<Producto>
                      items={Productos}
                      value={row.ProductoId}
                      onChange={(id) =>
                        updateRow(row._key, { ProductoId: id, presentacionId: '' })
                      }
                      loading={ProductosLoading}
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
                      placeholderCerrado="Elegí un Producto…"
                      placeholderBuscar="Buscar por nombre o código…"
                      inputClassName={`${INPUT} ${fieldErrors[`row_${idx}_ProductoId`] ? 'border-red-400' : ''}`}
                    />
                    <CrudFieldError message={fieldErrors[`row_${idx}_ProductoId`]} />
                  </div>

                  {/* Presentación */}
                  <div className="space-y-1">
                    <label className={LABEL}>Presentación <span className="text-red-500">*</span></label>
                    <select
                      value={row.presentacionId}
                      onChange={(e) => updateRow(row._key, { presentacionId: e.target.value })}
                      disabled={!row.ProductoId || pps.length === 0}
                      className={`h-9 w-full border bg-white px-2 text-sm disabled:opacity-50 ${fieldErrors[`row_${idx}_presentacionId`] ? 'border-red-400' : 'border-black/15'}`}
                    >
                      <option value="">
                        {!row.ProductoId ? 'Primero elegí un Producto' : 'Elegí una presentación…'}
                      </option>
                      {pps.map((pp) => (
                        <option key={pp.id} value={pp.id}>
                          {pp.presentacion?.nombre ?? pp.presentacionId} — {pp.unidadesPorBulto} uds/bulto
                        </option>
                      ))}
                    </select>
                    {selectedPP && (
                      <p className="text-xs text-vialto-steel">
                        {selectedPP.unidadesPorBulto} unidades por bulto
                      </p>
                    )}
                    <CrudFieldError message={fieldErrors[`row_${idx}_presentacionId`]} />
                  </div>

                  {/* Bultos */}
                  <div className="space-y-1">
                    <label className={LABEL}>Bultos <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.bultos}
                      onChange={(e) => updateRow(row._key, { bultos: e.target.value })}
                      className={`${INPUT} ${fieldErrors[`row_${idx}_bultos`] ? 'border-red-400' : ''}`}
                      placeholder="0"
                    />
                    {disponible !== null && (
                      <p className="text-xs text-vialto-steel">
                        Disponible:{' '}
                        <span className="font-semibold text-vialto-charcoal">
                          {disponible.cantidad1}
                        </span>{' '}
                        bultos
                      </p>
                    )}
                    <CrudFieldError message={fieldErrors[`row_${idx}_bultos`]} />
                  </div>

                  {/* Sueltas */}
                  <div className="space-y-1">
                    <label className={LABEL}>Sueltas</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.sueltas}
                      onChange={(e) => updateRow(row._key, { sueltas: e.target.value })}
                      className={`${INPUT} ${fieldErrors[`row_${idx}_sueltas`] ? 'border-red-400' : ''}`}
                      placeholder="0"
                    />
                    {disponible !== null && (
                      <p className="text-xs text-vialto-steel">
                        Disponible:{' '}
                        <span className="font-semibold text-vialto-charcoal">
                          {disponible.cantidad2}
                        </span>{' '}
                        sueltas
                      </p>
                    )}
                    <CrudFieldError message={fieldErrors[`row_${idx}_sueltas`]} />
                  </div>

                  {/* Lote */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className={LABEL}>Lote</label>
                    <input
                      type="text"
                      value={row.lote}
                      onChange={(e) => updateRow(row._key, { lote: e.target.value })}
                      className={INPUT}
                      placeholder="Ej: R17-25147"
                      maxLength={200}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addRow}
            className="w-full py-2 border border-dashed border-black/20 text-sm text-vialto-steel rounded hover:bg-vialto-mist/40 transition-colors"
          >
            + Agregar otra línea
          </button>
        </div>

        <CrudFormErrorAlert message={formError} />

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
    </div>
  );
}
