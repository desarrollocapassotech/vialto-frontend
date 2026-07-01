import { useAuth } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/lib/toast';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { ClienteModal } from '@/components/viajes/ClienteModal';
import { ChoferModal } from '@/components/viajes/ChoferModal';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';
import type { Chofer, Cliente, Deposito, Producto, StockItem } from '@/types/api';
import { EgresoWizardStep1 } from '@/components/stock/EgresoWizardStep1';
import { EgresoWizardStep2 } from '@/components/stock/EgresoWizardStep2';
import { EgresoWizardStep3, emptyEgresoRow, type EgresoRow } from '@/components/stock/EgresoWizardStep3';

type PaginatedProductos = { items: Producto[]; meta: unknown };
type EgresoResult = { id: string; numeroRemito: string | null; movimientosCount: number };
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
  { label: 'Entrega' },
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

export function EgresosStockTenantPage({
  tenantId,
  clientesExternos,
  clientesExternosLoading,
  choferesExternos,
  choferesExternosLoading,
}: {
  tenantId?: string;
  clientesExternos?: Cliente[];
  clientesExternosLoading?: boolean;
  choferesExternos?: Chofer[];
  choferesExternosLoading?: boolean;
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

  const [sessionChoferes, setSessionChoferes] = useState<Chofer[]>([]);
  const choferes = useMemo(() => {
    const base = choferesExternos ?? maestro.choferes;
    const ids = new Set(base.map((c) => c.id));
    return [...base, ...sessionChoferes.filter((c) => !ids.has(c.id))];
  }, [choferesExternos, maestro.choferes, sessionChoferes]);

  const clientesLoading = platform ? Boolean(clientesExternosLoading) : maestro.loading;
  const choferesLoading = platform ? Boolean(choferesExternosLoading) : maestro.loading;
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
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  // Todo el stock del tenant (sin filtros) — para filtrar clientes y depósitos con stock
  const [allStockItems, setAllStockItems] = useState<StockItem[]>([]);
  const [allStockLoading, setAllStockLoading] = useState(true);

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
  const [choferId, setChoferId] = useState('');
  const [destinatario, setDestinatario] = useState('');
  const [destinoFinal, setDestinoFinal] = useState('');
  const [observaciones, setObservaciones] = useState('');

  // Paso 3
  const [rows, setRows] = useState<EgresoRow[]>([emptyEgresoRow()]);

  // Estado compartido
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);
  const [modalChofer, setModalChofer] = useState(false);

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

  // Cargar todo el stock del tenant para filtrar clientes/depósitos en paso 1
  useEffect(() => {
    setAllStockLoading(true);
    void apiJson<StockItem[]>(`${disponibleBase}${buildQs({}, tenantId)}`, () => getToken())
      .then((items) => setAllStockItems(items.filter((s) => s.cantidad1 > 0 || s.cantidad2 > 0)))
      .catch(() => setAllStockItems([]))
      .finally(() => setAllStockLoading(false));
  }, [disponibleBase, tenantId, getToken]);

  // Cargar stock disponible para el cliente+depósito seleccionados (para mostrar disponible en paso 3)
  useEffect(() => {
    if (!clienteId || !depositoId) {
      setStockItems([]);
      return;
    }
    void apiJson<StockItem[]>(
      `${disponibleBase}${buildQs({ clienteId }, tenantId)}`,
      () => getToken(),
    )
      .then(setStockItems)
      .catch(() => setStockItems([]));
  }, [clienteId, depositoId, disponibleBase, tenantId, getToken]);

  function updateRow(key: string, patch: Partial<EgresoRow>) {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyEgresoRow()]);
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
    setChoferId('');
    setDestinatario('');
    setDestinoFinal('');
    setObservaciones('');
    setRows([emptyEgresoRow()]);
    setStockItems([]);
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
      const b = parseFloat(row.bultos) || 0;
      const s = parseFloat(row.sueltas) || 0;
      if (b <= 0 && s <= 0) {
        ferrs[`row_${idx}_bultos`] = 'Ingresá bultos o sueltas mayor a 0.';
      } else if (row.productoId && row.presentacionId) {
        const disponible =
          stockItems.find(
            (si) => si.productoId === row.productoId && si.presentacionId === row.presentacionId,
          ) ?? null;
        if (disponible) {
          if (b > disponible.cantidad1)
            ferrs[`row_${idx}_bultos`] = `Stock insuficiente. Disponible: ${disponible.cantidad1} bultos.`;
          if (s > disponible.cantidad2)
            ferrs[`row_${idx}_sueltas`] = `Stock insuficiente. Disponible: ${disponible.cantidad2} sueltas.`;
        }
      }
    });

    if (Object.keys(ferrs).length > 0) {
      setFieldErrors(ferrs);
      setFormError('Revisá los campos marcados en rojo.');
      return;
    }
    setFieldErrors({});

    const fechaIso = fechaHoraToIso(fechaMov, horaMov);
    if (!fechaIso) return setFormError('Revisá la fecha y hora del movimiento.');

    const entregadoPor = choferId.trim()
      ? choferes.find((c) => c.id === choferId)?.nombre.trim()
      : undefined;

    setSaving(true);
    try {
      const result = await apiJson<EgresoResult>(egresosUrl, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          clienteId,
          depositoId,
          fecha: fechaIso,
          entregadoPor: entregadoPor || undefined,
          destinatario: destinatario.trim() || undefined,
          destinoFinal: destinoFinal.trim() || undefined,
          observaciones: observaciones.trim() || undefined,
          lineas: rows.map((row) => ({
            productoId: row.productoId,
            presentacionId: row.presentacionId,
            bultos: parseFloat(row.bultos) || 0,
            sueltas: parseFloat(row.sueltas) || 0,
            lote: row.lote.trim() || undefined,
          })),
        }),
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

  // Clientes que tienen al menos un item con stock > 0
  const clientesFiltrados = useMemo(() => {
    if (allStockLoading) return [];
    const ids = new Set(allStockItems.map((s) => s.clienteId));
    return clientes.filter((c) => ids.has(c.id));
  }, [clientes, allStockItems, allStockLoading]);

  // Depósitos que tienen stock para el cliente seleccionado (o cualquiera si no hay cliente)
  const depositosFiltrados = useMemo(() => {
    if (allStockLoading) return [];
    const items = clienteId
      ? allStockItems.filter((s) => s.clienteId === clienteId)
      : allStockItems;
    const ids = new Set(items.map((s) => s.depositoId));
    return depositos.filter((d) => ids.has(d.id));
  }, [depositos, allStockItems, allStockLoading, clienteId]);

  const clienteNombre = clientes.find((c) => c.id === clienteId)?.nombre ?? '';
  const depositoNombre = depositos.find((d) => d.id === depositoId)?.nombre ?? '';
  const fechaLabel = formatFechaLabel(fechaMov, horaMov);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {!platform && (
        <div>
          <h1 className="text-2xl font-semibold text-vialto-charcoal">Egresos / despacho</h1>
          <p className="mt-1 text-sm text-vialto-steel">
            Registrá salida de mercadería. Se genera un número de remito interno y el stock se
            descuenta automáticamente al guardar.
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
        <EgresoWizardStep1
          clientes={clientesFiltrados}
          clienteId={clienteId}
          onClienteChange={(id) => {
            setClienteId(id);
            setStockItems([]);
            // Si el depósito actual no tiene stock para el nuevo cliente, lo limpiamos
            const depositosParaCliente = new Set(
              allStockItems.filter((s) => s.clienteId === id).map((s) => s.depositoId),
            );
            if (depositoId && !depositosParaCliente.has(depositoId)) setDepositoId('');
          }}
          clientesLoading={clientesLoading || allStockLoading}
          depositos={depositosFiltrados}
          depositoId={depositoId}
          onDepositoChange={(id) => {
            setDepositoId(id);
            setStockItems([]);
          }}
          fieldErrors={fieldErrors}
          onNuevoCliente={() => setModalCliente(true)}
          onContinuar={handleContinuar1}
        />
      )}

      {step === 2 && (
        <EgresoWizardStep2
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
          choferes={choferes}
          choferesLoading={choferesLoading}
          choferId={choferId}
          onChoferIdChange={setChoferId}
          onNuevoChofer={() => setModalChofer(true)}
          destinatario={destinatario}
          onDestinatarioChange={setDestinatario}
          destinoFinal={destinoFinal}
          onDestinoFinalChange={setDestinoFinal}
          observaciones={observaciones}
          onObservacionesChange={setObservaciones}
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
        <EgresoWizardStep3
          rows={rows}
          onAddRow={addRow}
          onRemoveRow={removeRow}
          onUpdateRow={updateRow}
          productos={productos}
          productosLoading={productosLoading}
          stockItems={stockItems}
          fieldErrors={fieldErrors}
          formError={formError}
          saving={saving}
          clienteId={clienteId}
          depositoId={depositoId}
          clienteNombre={clienteNombre}
          depositoNombre={depositoNombre}
          fechaLabel={fechaLabel}
          lotesBase={platform ? '/api/platform/stock/lotes' : '/api/stock/lotes'}
          tenantId={tenantId}
          onVolver={() => {
            setStep(2);
            setFieldErrors({});
            setFormError(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {modalChofer && (
        <ChoferModal
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => setModalChofer(false)}
          onSaved={(c) => {
            setSessionChoferes((prev) => [...prev, c]);
            setChoferId(c.id);
            setModalChofer(false);
            if (!tenantId) void maestro.refreshChoferes();
          }}
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
