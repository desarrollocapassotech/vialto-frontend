import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/lib/toast';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { AdjuntoPreviewModal } from '@/components/shared/AdjuntoPreviewModal';
import { uploadStockRemitoPdf } from '@/lib/stockRemitoUpload';
import { ClienteModal } from '@/components/viajes/ClienteModal';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';
import type { Cliente, Deposito, Producto } from '@/types/api';
import { IngresoWizardStep1 } from '@/components/stock/IngresoWizardStep1';
import { IngresoWizardStep2 } from '@/components/stock/IngresoWizardStep2';
import { IngresoWizardStep3, emptyRow, type IngresoRow } from '@/components/stock/IngresoWizardStep3';

type PaginatedProductos = { items: Producto[]; meta: unknown };
type WizardStep = 1 | 2 | 3;

function buildQs(params: Record<string, string | number>, tenantId?: string): string {
  const parts: string[] = [];
  if (tenantId) parts.push(`tenantId=${encodeURIComponent(tenantId)}`);
  for (const [k, v] of Object.entries(params))
    parts.push(`${k}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

const STEPS: { label: string }[] = [
  { label: 'Empresa' },
  { label: 'Fecha' },
  { label: 'Productos' },
];

function StepIndicator({ step }: { step: WizardStep }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const n = (i + 1) as WizardStep;
        const done = step > n;
        const active = step === n;
        return (
          <div key={n} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  active
                    ? 'border-vialto-fire bg-vialto-fire text-white'
                    : done
                    ? 'border-vialto-fire bg-white text-vialto-fire'
                    : 'border-black/20 bg-white text-vialto-steel'
                }`}
              >
                {done ? '✓' : n}
              </div>
              <span
                className={`text-[10px] leading-tight ${
                  active ? 'font-semibold text-vialto-charcoal' : 'text-vialto-steel'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-8 h-px mb-3 ${step > n ? 'bg-vialto-fire' : 'bg-black/10'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatFechaLabel(fecha: string, hora: string): string {
  if (!fecha) return '';
  try {
    const d = new Date(`${fecha}T${hora || '00:00'}`);
    const f = d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return hora ? `${f} ${hora}` : f;
  } catch {
    return fecha;
  }
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

  const clientesLoading = platform ? Boolean(clientesExternosLoading) : maestro.loading;
  const productosBase = platform ? '/api/platform/stock/productos' : '/api/stock/productos';
  const ingresosUrl = platform
    ? `/api/platform/stock/ingresos${buildQs({}, tenantId)}`
    : '/api/stock/ingresos';
  const depositosBase = platform ? '/api/platform/stock/depositos' : '/api/stock/depositos';
  const lotesBase = platform ? '/api/platform/stock/lotes' : '/api/stock/lotes';

  const [productos, setProductos] = useState<Producto[]>([]);
  const [depositos, setDepositos] = useState<Deposito[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productosLoading, setProductosLoading] = useState(true);

  // Wizard
  const [step, setStep] = useState<WizardStep>(1);

  // Paso 1
  const [clienteId, setClienteId] = useState('');
  const [depositoId, setDepositoId] = useState('');

  // Paso 2
  const partesInicial = isoToFechaHora(new Date().toISOString());
  const [fechaMov, setFechaMov] = useState(partesInicial.fecha);
  const [horaMov, setHoraMov] = useState(partesInicial.hora);
  const [fechaMovError, setFechaMovError] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [fotoFiles, setFotoFiles] = useState<File[]>([]);
  const [previewFoto, setPreviewFoto] = useState<File | null>(null);

  // Paso 3
  const [rows, setRows] = useState<IngresoRow[]>([emptyRow()]);

  // Estado compartido
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);

  const loadProductos = useCallback(async () => {
    setProductosLoading(true);
    setLoadError(null);
    try {
      const url = `${productosBase}/paginated${buildQs(
        { page: 1, pageSize: 200, filtroActivo: 'activos' },
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

  function updateRow(key: string, patch: Partial<IngresoRow>) {
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
    setObservaciones('');
    setFotoFiles([]);
    setRows([emptyRow()]);
    setFormError(null);
    setFieldErrors({});
    setStep(1);
  }

  function handleContinuar1() {
    const errs: Record<string, string> = {};
    if (!clienteId) errs.clienteId = 'Seleccioná una empresa/cliente.';
    if (!depositoId) errs.depositoId = 'Seleccioná un depósito.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setStep(2);
  }

  function handleContinuar2() {
    if (!fechaMov.trim()) {
      setFechaMovError('Ingresá la fecha del movimiento.');
      return;
    }
    setFechaMovError(null);
    setFieldErrors({});
    setFormError(null);
    setStep(3);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const ferrs: Record<string, string> = {};
    rows.forEach((row, idx) => {
      if (!row.productoId) ferrs[`row_${idx}_productoId`] = 'Seleccioná un producto.';
      if (!row.presentacionId)
        ferrs[`row_${idx}_presentacionId`] = 'Seleccioná una presentación.';
      if (!row.lote.trim()) ferrs[`row_${idx}_lote`] = 'Ingresá el lote.';
      if (!row.fechaVencimiento)
        ferrs[`row_${idx}_fechaVencimiento`] = 'Ingresá la fecha de vencimiento.';
      const b = parseFloat(row.bultos) || 0;
      const s = parseFloat(row.sueltas) || 0;
      if (b <= 0 && s <= 0)
        ferrs[`row_${idx}_bultos`] = 'Ingresá bultos o sueltas mayor a 0.';
    });

    if (Object.keys(ferrs).length > 0) {
      setFieldErrors(ferrs);
      setFormError('Revisá los campos marcados en rojo.');
      return;
    }
    setFieldErrors({});

    const fechaIso = fechaHoraToIso(fechaMov, horaMov);
    if (!fechaIso) return setFormError('Revisá la fecha y hora del movimiento.');
    if (fotoFiles.length > 2) return setFormError('Máximo 2 fotos por ingreso.');

    setSaving(true);
    try {
      const fotosUrls = await Promise.all(
        fotoFiles.map((f) => uploadStockRemitoPdf(getToken, f, tenantId)),
      );
      await apiJson(ingresosUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
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
        }),
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

  const clienteNombre = clientes.find((c) => c.id === clienteId)?.nombre ?? '';
  const depositoNombre = depositos.find((d) => d.id === depositoId)?.nombre ?? '';
  const fechaLabel = formatFechaLabel(fechaMov, horaMov);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {!platform && (
        <div>
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Ingresos al depósito</h1>
          <p className="mt-1 text-sm text-vialto-steel">
            Registrá mercadería entrante. El stock se actualiza automáticamente al guardar.
          </p>
        </div>
      )}

      {loadError && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <StepIndicator step={step} />
        <Link
          to={historialHref}
          className="shrink-0 inline-flex items-center gap-2 rounded border border-black/15 bg-white px-3 py-1.5 text-sm font-medium text-vialto-charcoal hover:bg-vialto-mist/60 transition-colors"
        >
          <img src="/icono-historial.png" alt="" className="h-5 w-5" aria-hidden />
          Historial
        </Link>
      </div>

      {step === 1 && (
        <IngresoWizardStep1
          clientes={clientes}
          clienteId={clienteId}
          onClienteChange={setClienteId}
          clientesLoading={clientesLoading}
          depositos={depositos}
          depositoId={depositoId}
          onDepositoChange={setDepositoId}
          fieldErrors={fieldErrors}
          onNuevoCliente={() => setModalCliente(true)}
          onContinuar={handleContinuar1}
        />
      )}

      {step === 2 && (
        <IngresoWizardStep2
          fechaMov={fechaMov}
          horaMov={horaMov}
          fechaMovError={fechaMovError}
          onFechaHoraPatch={(p) => {
            if (p.fechaCarga !== undefined) {
              setFechaMov(p.fechaCarga);
              if (p.fechaCarga) setFechaMovError(null);
            }
            if (p.horaCarga !== undefined) setHoraMov(p.horaCarga);
          }}
          observaciones={observaciones}
          onObservacionesChange={setObservaciones}
          fotoFiles={fotoFiles}
          onFotosChange={setFotoFiles}
          onFotoPreview={setPreviewFoto}
          fieldErrors={fieldErrors}
          saving={saving}
          clienteNombre={clienteNombre}
          depositoNombre={depositoNombre}
          onVolver={() => {
            setStep(1);
            setFieldErrors({});
            setFormError(null);
          }}
          onContinuar={handleContinuar2}
        />
      )}

      {step === 3 && (
        <IngresoWizardStep3
          rows={rows}
          onAddRow={addRow}
          onRemoveRow={removeRow}
          onUpdateRow={updateRow}
          productos={productos}
          productosLoading={productosLoading}
          fieldErrors={fieldErrors}
          formError={formError}
          saving={saving}
          clienteId={clienteId}
          depositoId={depositoId}
          clienteNombre={clienteNombre}
          depositoNombre={depositoNombre}
          fechaLabel={fechaLabel}
          lotesBase={lotesBase}
          tenantId={tenantId}
          onVolver={() => {
            setStep(2);
            setFieldErrors({});
            setFormError(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

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
