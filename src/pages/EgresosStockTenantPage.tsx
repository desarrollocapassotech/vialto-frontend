import { useAuth, useUser } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/lib/toast';
import { Link } from 'react-router-dom';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { paginatedItems } from '@/lib/paginatedItems';
import { productosConStockParaCliente } from '@/lib/stockProductosCliente';
import { useMaestroData } from '@/hooks/useMaestroData';
import { ChoferModal } from '@/components/viajes/ChoferModal';
import { ClienteModal } from '@/components/viajes/ClienteModal';
import { DestinatarioModal } from '@/components/destinatarios/DestinatarioModal';
import { DireccionEntregaModal } from '@/components/direcciones-entrega/DireccionEntregaModal';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';
import {
  stockDocumentoExternoParaApi,
  validarStockDocumentoExterno,
  type StockDocumentoExternoModo,
} from '@/lib/stockDocumentoExterno';
import {
  egresoOfreceFraccionar,
  egresoPendienteFraccionar,
  egresoSueltasAlcanzables,
  loteEgresoSeleccionValida,
} from '@/lib/stockLote';
import type {
  Chofer,
  Cliente,
  Deposito,
  Destinatario,
  DireccionEntrega,
  PaginatedResponse,
  Producto,
  StockItem,
} from '@/types/api';
import { EgresoWizardStep1 } from '@/components/stock/EgresoWizardStep1';
import { EgresoWizardStep2 } from '@/components/stock/EgresoWizardStep2';
import { EgresoWizardStep3, emptyEgresoRow, egresoFieldKey, egresoRowsToApiLineas, type EgresoRow } from '@/components/stock/EgresoWizardStep3';
import { useFieldConfig } from '@/hooks/useFieldConfig';
import { isStockOperator } from '@/lib/roleLabels';

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
  { label: 'Productos' },
  { label: 'Entrega' },
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

export function EgresosStockTenantPage({
  tenantId,
  clientesExternos,
  clientesExternosLoading,
  destinatariosExternos,
  destinatariosExternosLoading,
  choferesExternos,
  choferesExternosLoading,
  direccionesEntregaExternos,
  direccionesEntregaExternosLoading,
}: {
  tenantId?: string;
  clientesExternos?: Cliente[];
  clientesExternosLoading?: boolean;
  destinatariosExternos?: Destinatario[];
  destinatariosExternosLoading?: boolean;
  choferesExternos?: Chofer[];
  choferesExternosLoading?: boolean;
  direccionesEntregaExternos?: DireccionEntrega[];
  direccionesEntregaExternosLoading?: boolean;
}) {
  const { getToken, orgRole } = useAuth();
  const { user } = useUser();
  const { showToast } = useToast();
  const maestro = useMaestroData();
  const platform = Boolean(tenantId);
  const { isVisible } = useFieldConfig('stock');
  const puedeCrearEntidadesRelacionadas = !isStockOperator({
    orgRole,
    publicMetadata: user?.publicMetadata,
  });

  const [sessionClientes, setSessionClientes] = useState<Cliente[]>([]);
  const clientes = useMemo(() => {
    const base = clientesExternos ?? maestro.clientes;
    const ids = new Set(base.map((c) => c.id));
    return [...base, ...sessionClientes.filter((c) => !ids.has(c.id))];
  }, [clientesExternos, maestro.clientes, sessionClientes]);

  const [sessionDestinatarios, setSessionDestinatarios] = useState<Destinatario[]>([]);
  const destinatarios = useMemo(() => {
    const base = destinatariosExternos ?? maestro.destinatarios;
    const ids = new Set(base.map((d) => d.id));
    return [...base, ...sessionDestinatarios.filter((d) => !ids.has(d.id))];
  }, [destinatariosExternos, maestro.destinatarios, sessionDestinatarios]);

  const [sessionChoferes, setSessionChoferes] = useState<Chofer[]>([]);
  const choferes = useMemo(() => {
    const base = choferesExternos ?? maestro.choferes;
    const ids = new Set(base.map((c) => c.id));
    return [...base, ...sessionChoferes.filter((c) => !ids.has(c.id))];
  }, [choferesExternos, maestro.choferes, sessionChoferes]);

  const clientesLoading = platform ? Boolean(clientesExternosLoading) : maestro.loading;
  const destinatariosLoading = platform ? Boolean(destinatariosExternosLoading) : maestro.loading;
  const choferesLoading = platform ? Boolean(choferesExternosLoading) : maestro.loading;

  const [sessionDireccionesEntrega, setSessionDireccionesEntrega] = useState<DireccionEntrega[]>([]);
  const direccionesEntrega = useMemo(() => {
    const base = direccionesEntregaExternos ?? maestro.direccionesEntrega;
    const ids = new Set(base.map((d) => d.id));
    return [...base, ...sessionDireccionesEntrega.filter((d) => !ids.has(d.id))];
  }, [direccionesEntregaExternos, maestro.direccionesEntrega, sessionDireccionesEntrega]);

  const direccionesEntregaLoading = platform
    ? Boolean(direccionesEntregaExternosLoading)
    : maestro.loading;
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
  const [stockItemsLoading, setStockItemsLoading] = useState(false);
  const [allStockItems, setAllStockItems] = useState<StockItem[]>([]);
  const [allStockLoading, setAllStockLoading] = useState(true);

  const [step, setStep] = useState<WizardStep>(1);

  const [clienteId, setClienteId] = useState('');
  const [depositoId, setDepositoId] = useState('');

  const [rows, setRows] = useState<EgresoRow[]>([emptyEgresoRow()]);

  const partesInicial = isoToFechaHora(new Date().toISOString());
  const [fechaMov, setFechaMov] = useState(partesInicial.fecha);
  const [horaMov, setHoraMov] = useState(partesInicial.hora);
  const [fechaMovError, setFechaMovError] = useState<string | null>(null);
  const [choferId, setChoferId] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [direccionEntregaId, setDireccionEntregaId] = useState('');
  const [documentoExternoModo, setDocumentoExternoModo] = useState<StockDocumentoExternoModo | ''>('');
  const [documentoExternoNumero, setDocumentoExternoNumero] = useState('');
  const [documentoExternoError, setDocumentoExternoError] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [modalCliente, setModalCliente] = useState(false);
  const [modalDestinatario, setModalDestinatario] = useState(false);
  const [modalChofer, setModalChofer] = useState(false);
  const [modalDireccionEntrega, setModalDireccionEntrega] = useState(false);

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
    const url = `${depositosBase}${buildQs({ activo: '1', page: 1, pageSize: 500 }, tenantId)}`;
    void apiJson<PaginatedResponse<Deposito>>(url, () => getToken())
      .then((data) => setDepositos(paginatedItems(data)))
      .catch(() => setDepositos([]));
  }, [depositosBase, tenantId, getToken]);

  useEffect(() => {
    setAllStockLoading(true);
    void apiJson<StockItem[]>(`${disponibleBase}${buildQs({}, tenantId)}`, () => getToken())
      .then((items) => setAllStockItems(items.filter((s) => s.cantidad1 > 0 || s.cantidad2 > 0)))
      .catch(() => setAllStockItems([]))
      .finally(() => setAllStockLoading(false));
  }, [disponibleBase, tenantId, getToken]);

  useEffect(() => {
    if (!clienteId || !depositoId) {
      setStockItems([]);
      setStockItemsLoading(false);
      return;
    }
    setStockItemsLoading(true);
    void apiJson<StockItem[]>(
      `${disponibleBase}${buildQs({ clienteId, depositoId }, tenantId)}`,
      () => getToken(),
    )
      .then(setStockItems)
      .catch(() => setStockItems([]))
      .finally(() => setStockItemsLoading(false));
  }, [clienteId, depositoId, disponibleBase, tenantId, getToken]);

  useEffect(() => {
    setRows([emptyEgresoRow()]);
  }, [clienteId, depositoId]);

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
    setDestinatarioId('');
    setDireccionEntregaId('');
    setDocumentoExternoModo('');
    setDocumentoExternoNumero('');
    setDocumentoExternoError(null);
    setObservaciones('');
    setRows([emptyEgresoRow()]);
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

  function unidadesPorBultoDeFila(row: EgresoRow): number {
    const pps =
      productosParaEgreso.find((p) => p.id === row.productoId)?.productoPresentaciones ?? [];
    return pps.find((pp) => pp.id === row.presentacionId)?.unidadesPorBulto ?? 0;
  }

  function hayPendienteFraccionar(): boolean {
    return rows.some((row) => {
      const upb = unidadesPorBultoDeFila(row);
      return row.loteLineas.some((linea) =>
        egresoPendienteFraccionar(linea.loteStock, linea.sueltas, upb, linea.bultos),
      );
    });
  }

  function validateProductRows(): Record<string, string> {
    const ferrs: Record<string, string> = {};
    rows.forEach((row, idx) => {
      if (!row.productoId) ferrs[`row_${idx}_productoId`] = 'Seleccioná un producto.';
      else if (!productosParaEgreso.some((p) => p.id === row.productoId)) {
        ferrs[`row_${idx}_productoId`] = 'El producto no tiene stock para este cliente y depósito.';
      }
      if (!row.presentacionId)
        ferrs[`row_${idx}_presentacionId`] = 'Seleccioná una presentación.';

      const unidadesPorBulto = unidadesPorBultoDeFila(row);
      const lotesUsados = new Set<string>();
      row.loteLineas.forEach((linea, loteIdx) => {
        const loteKey = egresoFieldKey(idx, loteIdx, 'lote');
        const bultosKey = egresoFieldKey(idx, loteIdx, 'bultos');
        const sueltasKey = egresoFieldKey(idx, loteIdx, 'sueltas');

        if (!loteEgresoSeleccionValida(linea.lote)) {
          ferrs[loteKey] = 'Seleccioná un lote o Sin lote.';
        } else if (lotesUsados.has(linea.lote)) {
          ferrs[loteKey] = 'Este lote ya fue seleccionado en otra línea del mismo producto.';
        } else {
          lotesUsados.add(linea.lote);
        }

        const b = parseFloat(linea.bultos) || 0;
        const s = parseFloat(linea.sueltas) || 0;
        if (b <= 0 && s <= 0) {
          // Regla OR: al menos uno de los dos; el mensaje se muestra en ambos campos.
          const msg = 'Ingresá bultos o sueltas (al menos uno mayor a 0).';
          ferrs[bultosKey] = msg;
          ferrs[sueltasKey] = msg;
        } else if (loteEgresoSeleccionValida(linea.lote) && linea.loteStock) {
          if (b > linea.loteStock.bultos) {
            ferrs[bultosKey] =
              `Stock insuficiente. Disponible: ${linea.loteStock.bultos} bultos.`;
          }
          if (s > linea.loteStock.sueltas) {
            if (
              egresoOfreceFraccionar(
                linea.loteStock,
                linea.sueltas,
                unidadesPorBulto,
                linea.bultos,
              )
            ) {
              // Cubrible desarmando bultos: el botón contextual guía al usuario.
            } else {
              const maxSueltas = egresoSueltasAlcanzables(
                linea.loteStock,
                unidadesPorBulto,
                linea.bultos,
              );
              ferrs[sueltasKey] =
                `Stock insuficiente. Disponible: ${maxSueltas} sueltas (incl. bultos).`;
            }
          }
        }
      });
    });
    return ferrs;
  }

  function handleContinuar2() {
    const ferrs = validateProductRows();
    if (Object.keys(ferrs).length > 0) {
      setFieldErrors(ferrs);
      setFormError('Revisá los campos marcados en rojo.');
      return;
    }
    if (hayPendienteFraccionar()) {
      setFieldErrors({});
      setFormError(
        'Desarmá bultos con el botón junto al campo Sueltas antes de continuar.',
      );
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setStep(3);
  }

  function handleContinuar3() {
    if (!fechaMov.trim()) {
      setFechaMovError('Ingresá la fecha del movimiento.');
      return;
    }
    const docErr = validarStockDocumentoExterno(documentoExternoModo, documentoExternoNumero);
    if (docErr) {
      setDocumentoExternoError(docErr);
      return;
    }
    setFechaMovError(null);
    setDocumentoExternoError(null);
    void handleRegistrarEgreso();
  }

  async function handleRegistrarEgreso() {
    setFormError(null);
    setFieldErrors({});

    const fechaIso = fechaHoraToIso(fechaMov, horaMov);
    if (!fechaIso) {
      setFormError('Revisá la fecha y hora del movimiento.');
      return;
    }

    const entregadoPor = choferId.trim()
      ? choferes.find((c) => c.id === choferId)?.nombre.trim()
      : undefined;

    const destinoFinal =
      direccionEntregaId.trim()
        ? direccionesEntrega.find((d) => d.id === direccionEntregaId)?.direccion?.trim()
        : undefined;

    const numeroDocumentoExterno = stockDocumentoExternoParaApi(
      documentoExternoModo,
      documentoExternoNumero,
    );
    if (!numeroDocumentoExterno) {
      setStep(3);
      setDocumentoExternoError(
        validarStockDocumentoExterno(documentoExternoModo, documentoExternoNumero),
      );
      return;
    }

    const destinatario = destinatarioId.trim()
      ? destinatarios.find((d) => d.id === destinatarioId)?.nombre.trim()
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
          destinatario: destinatario || undefined,
          destinoFinal: destinoFinal || undefined,
          numeroDocumentoExterno,
          observaciones: observaciones.trim() || undefined,
          lineas: egresoRowsToApiLineas(rows),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleContinuar2();
  }

  const historialHref = platform
    ? `/stock/egresos/historial?tenantId=${encodeURIComponent(tenantId!)}`
    : '/stock/egresos/historial';

  const clientesFiltrados = useMemo(() => {
    if (allStockLoading) return [];
    const ids = new Set(allStockItems.map((s) => s.clienteId));
    return clientes.filter((c) => ids.has(c.id));
  }, [clientes, allStockItems, allStockLoading]);

  const depositosFiltrados = useMemo(() => {
    if (allStockLoading) return [];
    const items = clienteId
      ? allStockItems.filter((s) => s.clienteId === clienteId)
      : allStockItems;
    const ids = new Set(items.map((s) => s.depositoId));
    return depositos.filter((d) => ids.has(d.id));
  }, [depositos, allStockItems, allStockLoading, clienteId]);

  const productosParaEgreso = useMemo(
    () => productosConStockParaCliente(productos, stockItems, clienteId, depositoId),
    [productos, stockItems, clienteId, depositoId],
  );

  const clienteNombre = clientes.find((c) => c.id === clienteId)?.nombre ?? '';
  const depositoNombre = depositos.find((d) => d.id === depositoId)?.nombre ?? '';

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
            setRows([emptyEgresoRow()]);
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
            setRows([emptyEgresoRow()]);
          }}
          fieldErrors={fieldErrors}
          onNuevoCliente={puedeCrearEntidadesRelacionadas ? () => setModalCliente(true) : undefined}
          onContinuar={handleContinuar1}
        />
      )}

      {step === 2 && (
        <EgresoWizardStep3
          rows={rows}
          onAddRow={addRow}
          onRemoveRow={removeRow}
          onUpdateRow={updateRow}
          productos={productosParaEgreso}
          productosLoading={productosLoading || stockItemsLoading}
          fieldErrors={fieldErrors}
          formError={formError}
          clienteId={clienteId}
          depositoId={depositoId}
          clienteNombre={clienteNombre}
          depositoNombre={depositoNombre}
          lotesBase={platform ? '/api/platform/stock/lotes' : '/api/stock/lotes'}
          tenantId={tenantId}
          primaryAction="continuar"
          onVolver={() => {
            setStep(1);
            setFieldErrors({});
            setFormError(null);
          }}
          onSubmit={handleSubmit}
        />
      )}

      {step === 3 && (
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
          onNuevoChofer={puedeCrearEntidadesRelacionadas ? () => setModalChofer(true) : undefined}
          destinatarios={destinatarios}
          destinatariosLoading={destinatariosLoading}
          destinatarioId={destinatarioId}
          onDestinatarioIdChange={setDestinatarioId}
          onNuevoDestinatario={puedeCrearEntidadesRelacionadas ? () => setModalDestinatario(true) : undefined}
          direccionesEntrega={direccionesEntrega}
          direccionesEntregaLoading={direccionesEntregaLoading}
          direccionEntregaId={direccionEntregaId}
          onDireccionEntregaChange={setDireccionEntregaId}
          onNuevaDireccionEntrega={puedeCrearEntidadesRelacionadas ? () => setModalDireccionEntrega(true) : undefined}
          documentoExternoModo={documentoExternoModo}
          onDocumentoExternoModoChange={(modo) => {
            setDocumentoExternoModo(modo);
            setDocumentoExternoError(null);
            if (modo === 'no_tiene') setDocumentoExternoNumero('');
          }}
          documentoExternoNumero={documentoExternoNumero}
          onDocumentoExternoNumeroChange={(v) => {
            setDocumentoExternoNumero(v);
            if (documentoExternoError) setDocumentoExternoError(null);
          }}
          documentoExternoError={documentoExternoError}
          observaciones={observaciones}
          onObservacionesChange={setObservaciones}
          clienteNombre={clienteNombre}
          depositoNombre={depositoNombre}
          formError={formError}
          continuarLoading={saving}
          continuarLabel={saving ? 'Guardando…' : 'Registrar egreso'}
          onVolver={() => {
            setStep(2);
            setFieldErrors({});
            setFormError(null);
            setFechaMovError(null);
          }}
          onContinuar={handleContinuar3}
          isVisible={isVisible}
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

      {modalDestinatario && (
        <DestinatarioModal
          getToken={getToken}
          tenantId={tenantId}
          onClose={() => setModalDestinatario(false)}
          onSaved={(d) => {
            setSessionDestinatarios((prev) => [...prev, d]);
            setDestinatarioId(d.id);
            setModalDestinatario(false);
            if (!tenantId) void maestro.refreshDestinatarios();
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

      {modalDireccionEntrega && (
        <DireccionEntregaModal
          getToken={getToken}
          tenantId={tenantId}
          stacked
          onClose={() => setModalDireccionEntrega(false)}
          onSaved={(d) => {
            setSessionDireccionesEntrega((prev) => [...prev, d]);
            setDireccionEntregaId(d.id);
            setModalDireccionEntrega(false);
            if (!tenantId) void maestro.refreshDireccionesEntrega();
          }}
        />
      )}
    </div>
  );
}
