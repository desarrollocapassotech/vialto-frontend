import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Receipt } from 'lucide-react';
import {
  ConceptosLiquidacionLineasEditor,
  toConceptosLineasPayload,
  validateConceptosLineasDraft,
  type ConceptoLineaDraft,
} from '@/components/liquidaciones/ConceptosLiquidacionLineasEditor';
import { ApiError, apiFetch, apiJson } from '@/lib/api';
import {
  ARCA_CBTE_OVERRIDE_WARNING,
  condicionIvaLabel,
  cvlpCbteLabel,
  cvlpCbteTipoFromCondicionIva,
  type CvlpCbteTipo,
} from '@/lib/arcaCbteTipo';
import {
  collectCvlpEmitMissingFields,
  formatCvlpEmitMissingMessage,
} from '@/lib/cvlpEmitValidation';
import { friendlyError } from '@/lib/friendlyError';
import { MSG_ARCA_NO_LIQUIDA_USD, arcaBloqueaLiquidarUsd } from '@/lib/arcaUsdRestriction';
import { viajeTieneLiquidacionTransportista } from '@/lib/viajesComprobantes';
import type { ArcaConfig, Cliente, Liquidacion, Transportista, Viaje } from '@/types/api';

interface Props {
  viaje: Viaje;
  onClose: () => void;
  onEmitido: (liq: Liquidacion) => void;
}

type Step = 'tipo' | 'revision' | 'creada' | 'autorizada';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-vialto-steel">{label}</span>
      <span className="tabular-nums text-vialto-charcoal">{value}</span>
    </div>
  );
}

export function EmitirCvlpModal({ viaje, onClose, onEmitido }: Props) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const cvlpDisponible = !viajeTieneLiquidacionTransportista(viaje);
  const bloqueadoUsd = arcaBloqueaLiquidarUsd(
    true,
    viaje.monedaPrecioTransportistaExterno,
  );
  const puedeAvanzar = cvlpDisponible && !bloqueadoUsd;
  const condicionIva = viaje.transportista?.condicionIva ?? null;
  const sugerido = cvlpCbteTipoFromCondicionIva(condicionIva);

  const [step, setStep] = useState<Step>('tipo');
  const [cbteTipo, setCbteTipo] = useState<CvlpCbteTipo>(sugerido);
  const [periodoDesde, setPeriodoDesde] = useState('');
  const [periodoHasta, setPeriodoHasta] = useState('');
  const [comisionPct, setComisionPct] = useState('');
  const [ivaPct, setIvaPct] = useState('');
  const [conceptosLineas, setConceptosLineas] = useState<ConceptoLineaDraft[]>([]);
  const [conceptosIncomplete, setConceptosIncomplete] = useState<number[]>([]);
  const [busyCrear, setBusyCrear] = useState(false);
  const [busyArca, setBusyArca] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arcaConfigMissing, setArcaConfigMissing] = useState(false);
  const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [arcaConfig, setArcaConfig] = useState<ArcaConfig | null>(null);
  const [transportistaDetalle, setTransportistaDetalle] = useState<Transportista | null>(null);
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null);
  const [datosReady, setDatosReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setDatosReady(false);
    void (async () => {
      try {
        const cfg = await apiJson<ArcaConfig>('/api/integracion-arca/config', () => getToken());
        if (!cancelled) setArcaConfig(cfg);
      } catch {
        // config no disponible — la validación de emisión lo reporta
      }
      if (viaje.transportistaId) {
        try {
          const t = await apiJson<Transportista>(
            `/api/transportistas/${encodeURIComponent(viaje.transportistaId)}`,
            () => getToken(),
          );
          if (!cancelled) setTransportistaDetalle(t);
        } catch {
          // se valida con lo disponible en el viaje
        }
      }
      if (viaje.clienteId) {
        try {
          const c = await apiJson<Cliente>(
            `/api/clientes/${encodeURIComponent(viaje.clienteId)}`,
            () => getToken(),
          );
          if (!cancelled) setClienteDetalle(c);
        } catch {
          // se valida con lo disponible en el viaje
        }
      }
      if (!cancelled) setDatosReady(true);
    })();
    return () => { cancelled = true; };
  }, [getToken, viaje.transportistaId, viaje.clienteId]);

  const transportistaNombre = viaje.transportista?.nombre ?? viaje.transportistaId ?? '—';
  const periodoInvalido =
    Boolean(periodoDesde && periodoHasta && periodoHasta < periodoDesde);
  const periodoCompleto =
    Boolean(periodoDesde && periodoHasta) && !periodoInvalido;
  const overrideManual = cbteTipo !== sugerido;

  const missingEmitFields = useMemo(
    () =>
      collectCvlpEmitMissingFields({
        emisor: arcaConfig,
        transportista: transportistaDetalle ?? {
          condicionIva: viaje.transportista?.condicionIva ?? null,
          idFiscal: null,
          domicilio: null,
        },
        cliente: clienteDetalle ?? {
          nombre: viaje.cliente?.nombre ?? null,
          direccion: null,
          idFiscal: null,
        },
      }),
    [arcaConfig, transportistaDetalle, clienteDetalle, viaje.transportista?.condicionIva, viaje.cliente?.nombre],
  );
  const missingEmitMessage = formatCvlpEmitMissingMessage(missingEmitFields);
  const datosEmitIncompletos = datosReady && missingEmitFields.length > 0;

  function fmtMoney(n: number) {
    return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`;
  }

  function fmtDate(iso: string) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  async function handleCrear() {
    if (!viaje.transportistaId) return;
    if (bloqueadoUsd) {
      setError(MSG_ARCA_NO_LIQUIDA_USD);
      return;
    }
    if (datosEmitIncompletos) {
      setError(missingEmitMessage);
      return;
    }
    if (!periodoCompleto) {
      setError(
        periodoInvalido
          ? 'La fecha Hasta no puede ser anterior a Desde.'
          : 'Completá el período Desde y Hasta.',
      );
      return;
    }
    if (viajeTieneLiquidacionTransportista(viaje)) {
      setError(
        `La acción no es válida. Ya existe una liquidación previa para este transportista en el viaje #${viaje.numero}.`,
      );
      return;
    }
    const conceptosCheck = validateConceptosLineasDraft(conceptosLineas);
    if (!conceptosCheck.ok) {
      setConceptosIncomplete(conceptosCheck.indices);
      setError(conceptosCheck.message);
      return;
    }
    setConceptosIncomplete([]);
    setError(null);
    setBusyCrear(true);
    try {
      const body: Record<string, unknown> = {
        transportistaId: viaje.transportistaId,
        periodoDesde,
        periodoHasta,
        viajeIds: [viaje.id],
        cbteTipo,
      };
      if (comisionPct.trim() !== '') body.comisionPct = Number(comisionPct);
      if (ivaPct.trim() !== '') body.ivaPct = Number(ivaPct);
      const lineasPayload = toConceptosLineasPayload(conceptosLineas);
      if (lineasPayload.length > 0) body.conceptosLineas = lineasPayload;
      const liq = await apiJson<Liquidacion>(
        '/api/integracion-arca/liquidaciones',
        () => getToken(),
        { method: 'POST', body: JSON.stringify(body) },
      );
      setLiquidacion(liq);
      setStep('creada');
      onEmitido(liq);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && err.message?.toLowerCase().includes('arca')) {
        setArcaConfigMissing(true);
        setError(err.message);
      } else {
        setArcaConfigMissing(false);
        setError(friendlyError(err, 'liquidaciones'));
      }
    } finally {
      setBusyCrear(false);
    }
  }

  async function handleEmitirArca() {
    if (!liquidacion) return;
    if (datosEmitIncompletos) {
      setError(missingEmitMessage);
      return;
    }
    setError(null);
    setBusyArca(true);
    try {
      const liq = await apiJson<Liquidacion>(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liquidacion.id)}/emitir`,
        () => getToken(),
        { method: 'POST' },
      );
      setLiquidacion(liq);
      setStep('autorizada');
      onEmitido(liq);
    } catch (err) {
      setError(friendlyError(err, 'arca'));
    } finally {
      setBusyArca(false);
    }
  }

  async function descargarPdf() {
    if (!liquidacion) return;
    setDownloading(true);
    try {
      const res = await apiFetch(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liquidacion.id)}/pdf`,
        () => getToken(),
      );
      if (!res.ok) throw new Error('Error al generar el PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `liquidacion-${liquidacion.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(friendlyError(err, 'arca'));
    } finally {
      setDownloading(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  const stepLabel =
    step === 'tipo' ? '1 de 2' : step === 'revision' ? '2 de 2' : null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg bg-white shadow-xl border border-black/20 flex flex-col max-h-[90dvh]">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 shrink-0">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
              Liquidación a transportista
            </h2>
            {stepLabel && (
              <p className="text-xs text-vialto-steel mt-0.5">Paso {stepLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {step === 'tipo' && (
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-wider text-vialto-steel">
                Tipo de comprobante
              </p>

              <div className="grid grid-cols-2 gap-3">
                {([60, 61] as CvlpCbteTipo[]).map((t) => {
                  const selected = cbteTipo === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!puedeAvanzar}
                      onClick={() => {
                        if (puedeAvanzar) setCbteTipo(t);
                      }}
                      className={[
                        'flex flex-col items-center justify-center border py-4 px-2 text-xs uppercase tracking-wider transition-colors',
                        !puedeAvanzar
                          ? 'border-black/10 bg-vialto-mist/40 text-vialto-steel cursor-not-allowed opacity-60'
                          : selected
                            ? 'border-vialto-charcoal bg-vialto-charcoal text-white'
                            : 'border-black/20 text-vialto-charcoal hover:bg-vialto-mist',
                      ].join(' ')}
                    >
                      CVLP
                      <span className="mt-1 text-[10px] normal-case tracking-normal opacity-80">
                        {cvlpCbteLabel(t)}
                      </span>
                      {t === sugerido && (
                        <span className="mt-1 text-[10px] normal-case tracking-normal opacity-70">
                          Sugerido
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rounded border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-xs text-amber-950 space-y-1">
                <p>
                  Corresponde a la condición frente al IVA del transportista:{' '}
                  <span className="font-medium">{condicionIvaLabel(condicionIva)}</span>
                  {' → '}
                  <span className="font-medium">{cvlpCbteLabel(sugerido)}</span>.
                </p>
                <p>{ARCA_CBTE_OVERRIDE_WARNING}</p>
                {overrideManual && (
                  <p className="font-medium text-amber-900">
                    Estás usando un tipo distinto al sugerido ({cvlpCbteLabel(cbteTipo)}).
                  </p>
                )}
              </div>

              {bloqueadoUsd && (
                <p
                  className="text-xs text-amber-900 border border-amber-400/40 bg-amber-50 px-3 py-2"
                  role="alert"
                >
                  {MSG_ARCA_NO_LIQUIDA_USD}
                </p>
              )}

              {!cvlpDisponible && (
                <p className="text-xs text-vialto-steel border border-black/10 bg-vialto-mist/40 px-3 py-2">
                  Este viaje ya tiene una liquidación activa para el transportista.
                </p>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!puedeAvanzar}
                  onClick={() => setStep('revision')}
                  className="h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {step === 'revision' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider text-vialto-steel">Tipo:</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-vialto-charcoal">
                  CVLP
                </span>
                <span className="text-xs text-vialto-steel">({cvlpCbteLabel(cbteTipo)})</span>
              </div>

              <section className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  Transportista
                </p>
                <p className="text-sm text-vialto-charcoal font-medium">{transportistaNombre}</p>
                <p className="text-xs text-vialto-steel">{condicionIvaLabel(condicionIva)}</p>
              </section>

              {bloqueadoUsd && (
                <p
                  className="text-xs text-amber-900 border border-amber-400/40 bg-amber-50 px-3 py-2"
                  role="alert"
                >
                  {MSG_ARCA_NO_LIQUIDA_USD}
                </p>
              )}

              <section className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  Período
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="periodoDesde" className="block text-xs text-vialto-steel mb-1">
                      Desde <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="periodoDesde"
                      type="date"
                      required
                      value={periodoDesde}
                      onChange={(e) => {
                        const next = e.target.value;
                        setPeriodoDesde(next);
                        if (periodoHasta && next && periodoHasta < next) {
                          setPeriodoHasta('');
                        }
                      }}
                      className="w-full h-9 border border-black/20 px-3 text-sm focus:outline-none focus:border-vialto-charcoal"
                    />
                  </div>
                  <div>
                    <label htmlFor="periodoHasta" className="block text-xs text-vialto-steel mb-1">
                      Hasta <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="periodoHasta"
                      type="date"
                      required
                      value={periodoHasta}
                      min={periodoDesde || undefined}
                      onChange={(e) => setPeriodoHasta(e.target.value)}
                      className={`w-full h-9 border px-3 text-sm focus:outline-none focus:border-vialto-charcoal ${
                        periodoInvalido ? 'border-red-400' : 'border-black/20'
                      }`}
                    />
                    {periodoInvalido && (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        Hasta no puede ser anterior a Desde.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  Detalle del viaje
                </p>
                <div className="bg-vialto-mist/50 px-3 py-2 space-y-1.5">
                  <Row label="Número" value={`#${viaje.numero}`} />
                  <Row
                    label="Fecha de carga"
                    value={
                      viaje.fechaCarga
                        ? fmtDate(viaje.fechaCarga.slice(0, 10))
                        : '—'
                    }
                  />
                  <Row label="Origen" value={viaje.origen ?? '—'} />
                  <Row label="Destino" value={viaje.destino ?? '—'} />
                  <Row
                    label="Bruto"
                    value={
                      viaje.precioTransportistaExterno != null
                        ? fmtMoney(viaje.precioTransportistaExterno)
                        : '—'
                    }
                  />
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  Comisión por flete
                </p>
                <div className="flex items-center gap-2">
                  <input
                    id="comisionPct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={comisionPct}
                    onChange={(e) => setComisionPct(e.target.value)}
                    placeholder={
                      arcaConfig != null ? String(arcaConfig.comisionPctDefault) : ''
                    }
                    className="w-52 h-9 border border-black/20 px-3 text-sm focus:outline-none focus:border-vialto-charcoal"
                  />
                  <span className="text-xs text-vialto-steel">%</span>
                </div>
                <p className="text-xs text-vialto-steel">
                  Vacío usa el default del tenant
                  {arcaConfig != null
                    ? ` (${arcaConfig.comisionPctDefault}%).`
                    : '.'}
                </p>
              </section>

              <section className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  IVA
                </p>
                <div className="flex items-center gap-2">
                  <input
                    id="ivaPct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={ivaPct}
                    onChange={(e) => setIvaPct(e.target.value)}
                    placeholder={
                      arcaConfig != null ? String(arcaConfig.ivaGastosAdmin) : ''
                    }
                    className="w-52 h-9 border border-black/20 px-3 text-sm focus:outline-none focus:border-vialto-charcoal"
                  />
                  <span className="text-xs text-vialto-steel">%</span>
                </div>
                <p className="text-xs text-vialto-steel">
                  Vacío usa el default del tenant
                  {arcaConfig != null ? ` (${arcaConfig.ivaGastosAdmin}%).` : '.'}
                </p>
              </section>

              <section className="space-y-2">
                <ConceptosLiquidacionLineasEditor
                  getToken={getToken}
                  lineas={conceptosLineas}
                  onChange={(next) => {
                    setConceptosLineas(next);
                    setConceptosIncomplete([]);
                  }}
                  disabled={busyCrear}
                  incompleteIndices={conceptosIncomplete}
                />
              </section>

              {datosEmitIncompletos && (
                <div className="border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
                  <p className="font-medium">Completá estos datos antes de emitir</p>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5">
                    {missingEmitFields.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-700 border border-red-200 bg-red-50 px-3 py-2">
                  {error}
                </p>
              )}
              {arcaConfigMissing && (
                <button
                  type="button"
                  onClick={() => { onClose(); navigate('/configuracion/arca'); }}
                  className="w-full h-9 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
                >
                  Ir a configuración de ARCA
                </button>
              )}

              <div className="flex justify-between pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('tipo'); setError(null); setArcaConfigMissing(false); }}
                  className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
                >
                  ← Volver
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={
                      busyCrear ||
                      !periodoCompleto ||
                      !datosReady ||
                      datosEmitIncompletos ||
                      bloqueadoUsd
                    }
                    onClick={() => void handleCrear()}
                    className="h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {busyCrear ? 'Creando…' : 'Crear liquidación'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'creada' && liquidacion && (
            <div className="space-y-5">
              <div className="border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-medium text-amber-800">Liquidación creada</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Los montos fueron calculados. Revisá el detalle y enviá a ARCA para obtener el CAE.
                </p>
              </div>

              <section className="space-y-1.5">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  Detalle del comprobante
                </p>
                <Row label="Tipo" value={cvlpCbteLabel((liquidacion.cbteTipo === 61 ? 61 : 60) as CvlpCbteTipo)} />
                <Row label="Transportista" value={transportistaNombre} />
                <Row label="Período" value={`${fmtDate(liquidacion.periodoDesde.slice(0, 10))} — ${fmtDate(liquidacion.periodoHasta.slice(0, 10))}`} />
                <Row label="Bruto" value={fmtMoney(liquidacion.bruto)} />
                <Row label={`Comisión (${liquidacion.comisionPct}%)`} value={fmtMoney(liquidacion.comision)} />
                <Row label={`IVA (${liquidacion.ivaPct ?? arcaConfig?.ivaGastosAdmin ?? '—'}%)`} value={fmtMoney(liquidacion.gastosAdminIva)} />
                <div className="flex justify-between text-xs font-semibold text-vialto-charcoal border-t border-black/10 pt-1.5 mt-0.5">
                  <span>Líquido a pagar</span>
                  <span className="tabular-nums">{fmtMoney(liquidacion.liquido)}</span>
                </div>
              </section>

              {datosEmitIncompletos && (
                <div className="border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
                  <p className="font-medium">Completá estos datos antes de emitir</p>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5">
                    {missingEmitFields.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-700 border border-red-200 bg-red-50 px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={busyArca || !datosReady || datosEmitIncompletos}
                  onClick={() => void handleEmitirArca()}
                  className="inline-flex items-center gap-2 h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90 disabled:opacity-50"
                >
                  {!busyArca && <Receipt className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />}
                  {busyArca ? 'Enviando a ARCA…' : 'Emitir a ARCA'}
                </button>
              </div>
            </div>
          )}

          {step === 'autorizada' && liquidacion && (
            <div className="space-y-5">
              <div className="border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm font-medium text-emerald-800">Comprobante autorizado por ARCA</p>
                {liquidacion.cae && (
                  <p className="text-xs text-emerald-700 mt-0.5">CAE: {liquidacion.cae}</p>
                )}
                {liquidacion.caeFechaVto && (
                  <p className="text-xs text-emerald-700">Vto. CAE: {liquidacion.caeFechaVto}</p>
                )}
              </div>

              <section className="space-y-1.5">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  Resumen
                </p>
                <Row label="Tipo" value={cvlpCbteLabel((liquidacion.cbteTipo === 61 ? 61 : 60) as CvlpCbteTipo)} />
                <Row label="Transportista" value={transportistaNombre} />
                <Row label="Período" value={`${fmtDate(liquidacion.periodoDesde.slice(0, 10))} — ${fmtDate(liquidacion.periodoHasta.slice(0, 10))}`} />
                <Row label="Bruto" value={fmtMoney(liquidacion.bruto)} />
                <Row label={`Comisión (${liquidacion.comisionPct}%)`} value={fmtMoney(liquidacion.comision)} />
                <Row label={`IVA (${liquidacion.ivaPct ?? arcaConfig?.ivaGastosAdmin ?? '—'}%)`} value={fmtMoney(liquidacion.gastosAdminIva)} />
                <div className="flex justify-between text-xs font-semibold text-vialto-charcoal border-t border-black/10 pt-1.5 mt-0.5">
                  <span>Líquido a pagar</span>
                  <span className="tabular-nums">{fmtMoney(liquidacion.liquido)}</span>
                </div>
              </section>

              {error && (
                <p className="text-xs text-red-700 border border-red-200 bg-red-50 px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void descargarPdf()}
                  className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                >
                  {downloading ? 'Generando…' : 'Descargar PDF'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
