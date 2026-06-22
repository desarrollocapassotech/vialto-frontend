import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { isRemitoAdjuntoFile, uploadStockRemitoPdf } from '@/lib/stockRemitoUpload';
import { ClienteModal } from '@/components/viajes/ClienteModal';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import type { Cliente, Deposito, Producto, ProductoPresentacion } from '@/types/api';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';

type PaginatedProductos = { items: Producto[]; meta: unknown };

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

type IngresoRow = {
  _key: string;
  productoId: string;
  presentacionId: string;
  bultos: string;
  sueltas: string;
  lote: string;
  fechaVencimiento: string;
};

function emptyRow(): IngresoRow {
  return {
    _key: crypto.randomUUID(),
    productoId: '',
    presentacionId: '',
    bultos: '',
    sueltas: '',
    lote: '',
    fechaVencimiento: '',
  };
}

function buildQs(params: Record<string, string | number>, tenantId?: string): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  for (const [k, v] of Object.entries(params)) parts.push(`${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function getPresentaciones(productos: Producto[], productoId: string): ProductoPresentacion[] {
  return productos.find((p) => p.id === productoId)?.productoPresentaciones ?? [];
}

export function IngresosStockTenantPage({
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
  const ingresosUrl = platform
    ? `/api/platform/stock/ingresos${buildQs({}, tenantId)}`
    : '/api/stock/ingresos';
  const depositosBase = platform ? '/api/platform/stock/depositos' : '/api/stock/depositos';

  const [productos, setProductos] = useState<Producto[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productosLoading, setProductosLoading] = useState(true);

  // Header
  const [clienteId, setClienteId] = useState('');
  const [depositoId, setDepositoId] = useState('');
  const partesInicial = isoToFechaHora(new Date().toISOString());
  const [fechaMov, setFechaMov] = useState(partesInicial.fecha);
  const [horaMov, setHoraMov] = useState(partesInicial.hora);
  const [fechaMovError, setFechaMovError] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [fotoFiles, setFotoFiles] = useState<File[]>([]);
  const [previewFoto, setPreviewFoto] = useState<File | null>(null);

  // Líneas
  const [rows, setRows] = useState<IngresoRow[]>([emptyRow()]);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);

  const loadProductos = useCallback(async () => {
    setProductosLoading(true);
    setLoadError(null);
    try {
      const url = `${productosBase}/paginated${buildQs({ page: 1, pageSize: 200, filtroActivo: 'activos' }, tenantId)}`;
      const data = await apiJson<PaginatedProductos>(url, () => getToken());
      setProductos(data.items);
    } catch (e) {
      setLoadError(friendlyError(e, 'stock'));
    } finally {
      setProductosLoading(false);
    }
  }, [productosBase, tenantId, getToken]);

  useEffect(() => { void loadProductos(); }, [loadProductos]);

  useEffect(() => {
    const url = `${depositosBase}${buildQs({ activo: '1' }, tenantId)}`;
    void apiJson<Deposito[]>(url, () => getToken())
      .then(setDepositos)
      .catch(() => setDepositos([]));
  }, [depositosBase, tenantId, getToken]);

  function updateRow(key: string, patch: Partial<IngresoRow>) {
    setRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, ...patch } : r)),
    );
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
    setObservaciones('');
    setFotoFiles([]);
    setRows([emptyRow()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const ferrs: Record<string, string> = {};
    if (!clienteId) ferrs.clienteId = 'Seleccioná una empresa/cliente.';
    if (!depositoId) ferrs.depositoId = 'Seleccioná un depósito.';

    rows.forEach((row, idx) => {
      if (!row.productoId) ferrs[`row_${idx}_productoId`] = 'Seleccioná un producto.';
      if (!row.presentacionId) ferrs[`row_${idx}_presentacionId`] = 'Seleccioná una presentación.';
      if (!row.lote.trim()) ferrs[`row_${idx}_lote`] = 'Ingresá el lote.';
      if (!row.fechaVencimiento) ferrs[`row_${idx}_fechaVencimiento`] = 'Ingresá la fecha de vencimiento.';
      const b = parseFloat(row.bultos) || 0;
      const s = parseFloat(row.sueltas) || 0;
      if (b <= 0 && s <= 0) ferrs[`row_${idx}_bultos`] = 'Ingresá bultos o sueltas mayor a 0.';
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

    if (fotoFiles.length > 2) return setFormError('Máximo 2 fotos por ingreso.');

    setSaving(true);
    try {
      const fotosUrls = await Promise.all(
        fotoFiles.map((f) => uploadStockRemitoPdf(getToken, f, tenantId)),
      );

      const body = {
        clienteId,
        depositoId,
        fecha: fechaIso,
        fotosUrls,
        observaciones: observaciones.trim() || undefined,
        lineas: rows.map((row) => ({
          productoId: row.productoId,
          presentacionId: row.presentacionId,
          bultos: parseFloat(row.bultos) || 0,
          sueltas: parseFloat(row.sueltas) || 0,
          lote: row.lote.trim(),
          fechaVencimiento: row.fechaVencimiento,
        })),
      };

      await apiJson(ingresosUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showToast('Ingreso registrado correctamente.');
      resetForm();
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
    <div className="max-w-4xl mx-auto space-y-8">
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── CABECERA ── */}
        <div className="bg-white rounded-lg border border-black/10 p-6 space-y-5">
          <h2 className="text-base font-semibold text-vialto-charcoal">Datos del ingreso</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 min-w-0">
              <label className={LABEL}>Empresa / Cliente <span className="text-red-500">*</span></label>
              <ClienteSearchSelect
                clientes={clientes}
                value={clienteId}
                onChange={setClienteId}
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
                onChange={(e) => setDepositoId(e.target.value)}
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

          <FotosIngresoField
            files={fotoFiles}
            onChange={setFotoFiles}
            onPreview={setPreviewFoto}
            disabled={saving}
            error={fieldErrors.fotosUrls}
          />
        </div>

        {/* ── LÍNEAS ── */}
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

          {rows.map((row, idx) => {
            const pps = getPresentaciones(productos, row.productoId);
            const selectedPP = pps.find((pp) => pp.id === row.presentacionId);

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
                      items={productos}
                      value={row.productoId}
                      onChange={(id) =>
                        updateRow(row._key, { productoId: id, presentacionId: '' })
                      }
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
                      inputClassName={`${INPUT} ${fieldErrors[`row_${idx}_productoId`] ? 'border-red-400' : ''}`}
                    />
                    <CrudFieldError message={fieldErrors[`row_${idx}_productoId`]} />
                  </div>

                  {/* Presentación */}
                  <div className="space-y-1">
                    <label className={LABEL}>Presentación <span className="text-red-500">*</span></label>
                    <select
                      value={row.presentacionId}
                      onChange={(e) => updateRow(row._key, { presentacionId: e.target.value })}
                      disabled={!row.productoId || pps.length === 0}
                      className={`h-9 w-full border bg-white px-2 text-sm disabled:opacity-50 ${fieldErrors[`row_${idx}_presentacionId`] ? 'border-red-400' : 'border-black/15'}`}
                    >
                      <option value="">
                        {!row.productoId ? 'Primero elegí un producto' : 'Elegí una presentación…'}
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
                      className={INPUT}
                      placeholder="0"
                    />
                  </div>

                  {/* Lote */}
                  <div className="space-y-1">
                    <label className={LABEL}>Lote <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={row.lote}
                      onChange={(e) => updateRow(row._key, { lote: e.target.value })}
                      className={`${INPUT} ${fieldErrors[`row_${idx}_lote`] ? 'border-red-400' : ''}`}
                      placeholder="Ej: R17-25147"
                      maxLength={200}
                    />
                    <CrudFieldError message={fieldErrors[`row_${idx}_lote`]} />
                  </div>

                  {/* Fecha de vencimiento */}
                  <div className="space-y-1">
                    <label className={LABEL}>Vencimiento <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      value={row.fechaVencimiento}
                      onChange={(e) => updateRow(row._key, { fechaVencimiento: e.target.value })}
                      className={`${INPUT} ${fieldErrors[`row_${idx}_fechaVencimiento`] ? 'border-red-400' : ''}`}
                    />
                    <CrudFieldError message={fieldErrors[`row_${idx}_fechaVencimiento`]} />
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
            {saving ? 'Guardando…' : 'Registrar ingreso'}
          </button>
        </div>
      </form>

      {previewFoto && (
        <AdjuntoPreviewModal
          file={previewFoto}
          title="Foto del ingreso"
          onClose={() => setPreviewFoto(null)}
        />
      )}

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

const MAX_FOTOS = 2;
const ACCEPT_FOTOS = 'image/jpeg,image/png,.jpg,.jpeg,.png';

const BTN_SM =
  'h-8 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50';

function FotosIngresoField({
  files,
  onChange,
  onPreview,
  disabled,
  error,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  onPreview: (file: File) => void;
  disabled: boolean;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []).filter(isRemitoAdjuntoFile);
    const combined = [...files, ...selected].slice(0, MAX_FOTOS);
    onChange(combined);
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeFile(idx: number) {
    onChange(files.filter((_, i) => i !== idx));
  }

  const canAdd = files.length < MAX_FOTOS;

  return (
    <div className="space-y-1">
      <span className={LABEL}>
        Fotos
        <span className="ml-1 normal-case font-normal text-vialto-steel">(máx. 2 imágenes JPG/PNG)</span>
      </span>

      <div className="space-y-2">
        {files.map((file, idx) => (
          <div
            key={`${file.name}-${idx}`}
            className="flex items-center gap-2 rounded border border-black/10 bg-vialto-mist/30 px-3 py-2"
          >
            <span className="text-sm text-vialto-charcoal truncate flex-1 min-w-0" title={file.name}>
              Foto {idx + 1} — {file.name}
            </span>
            <button type="button" disabled={disabled} onClick={() => onPreview(file)} className={BTN_SM}>
              Ver
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeFile(idx)}
              className="text-xs uppercase tracking-wider text-vialto-fire hover:underline disabled:opacity-50"
            >
              Quitar
            </button>
          </div>
        ))}

        {canAdd && (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50"
            >
              + Agregar foto
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_FOTOS}
              className="sr-only"
              onChange={handleSelect}
            />
          </>
        )}
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
