import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Receipt } from 'lucide-react';
import { ApiError, apiFetch, apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { ArcaConfig, Liquidacion, Viaje } from '@/types/api';

interface Props {
  viaje: Viaje;
  onClose: () => void;
  onEmitido: (liq: Liquidacion) => void;
}

type TipoComprobante = 'cvlp' | 'a' | 'b';
type Step = 'tipo' | 'revision' | 'creada' | 'autorizada';

const TIPO_LABEL: Record<TipoComprobante, string> = {
  cvlp: 'CVLP',
  a: 'Factura A',
  b: 'Factura B',
};

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
  const [step, setStep] = useState<Step>('tipo');
  const [tipo, setTipo] = useState<TipoComprobante>('cvlp');
  const [periodoDesde, setPeriodoDesde] = useState('');
  const [periodoHasta, setPeriodoHasta] = useState('');
  const [comisionPct, setComisionPct] = useState('');
  const [busyCrear, setBusyCrear] = useState(false);
  const [busyArca, setBusyArca] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arcaConfigMissing, setArcaConfigMissing] = useState(false);
  const [liquidacion, setLiquidacion] = useState<Liquidacion | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [arcaConfig, setArcaConfig] = useState<ArcaConfig | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await apiJson<ArcaConfig>('/api/liquidaciones-arca/config', () => getToken());
        if (!cancelled) setArcaConfig(cfg);
      } catch {
        // config no disponible — se omite el placeholder
      }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  const transportistaNombre = viaje.transportista?.nombre ?? viaje.transportistaId ?? '—';

  const gastosAdminArs = (Array.isArray(viaje.otrosGastos) ? viaje.otrosGastos : []).filter(
    (g) => (g.moneda ?? 'ARS') === 'ARS',
  );
  const totalGastosAdminArs = gastosAdminArs.reduce((acc, g) => acc + (g.monto ?? 0), 0);

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
    setError(null);
    setBusyCrear(true);
    try {
      const body: Record<string, unknown> = {
        transportistaId: viaje.transportistaId,
        periodoDesde,
        periodoHasta,
        viajeIds: [viaje.id],
      };
      if (comisionPct.trim() !== '') body.comisionPct = Number(comisionPct);
      const liq = await apiJson<Liquidacion>(
        '/api/liquidaciones-arca/liquidaciones',
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
        setError(friendlyError(err, 'arca'));
      }
    } finally {
      setBusyCrear(false);
    }
  }

  async function handleEmitirArca() {
    if (!liquidacion) return;
    setError(null);
    setBusyArca(true);
    try {
      const liq = await apiJson<Liquidacion>(
        `/api/liquidaciones-arca/liquidaciones/${encodeURIComponent(liquidacion.id)}/emitir`,
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
        `/api/liquidaciones-arca/liquidaciones/${encodeURIComponent(liquidacion.id)}/pdf`,
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
      <div className="w-full max-w-lg bg-white shadow-xl border border-black/20">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
              Emitir comprobante
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

        <div className="px-6 py-5">
          {/* ── Paso 1: tipo ── */}
          {step === 'tipo' && (
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-wider text-vialto-steel">
                Tipo de comprobante
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(['cvlp', 'a', 'b'] as TipoComprobante[]).map((t) => {
                  const disabled = t !== 'cvlp';
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={disabled}
                      onClick={() => setTipo(t)}
                      className={[
                        'flex flex-col items-center justify-center border py-4 px-2 text-xs uppercase tracking-wider transition-colors',
                        disabled
                          ? 'border-black/10 text-black/30 cursor-not-allowed bg-gray-50'
                          : tipo === t
                            ? 'border-vialto-charcoal bg-vialto-charcoal text-white'
                            : 'border-black/20 text-vialto-charcoal hover:bg-vialto-mist',
                      ].join(' ')}
                    >
                      {TIPO_LABEL[t]}
                      {disabled && (
                        <span className="mt-1 text-[10px] normal-case tracking-normal opacity-60">
                          próximamente
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
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
                  onClick={() => setStep('revision')}
                  className="h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {/* ── Paso 2: revisión ── */}
          {step === 'revision' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-vialto-steel">Tipo:</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-vialto-charcoal">
                  {TIPO_LABEL[tipo]}
                </span>
                <span className="text-xs text-vialto-steel">(Comprobante Tipo 60)</span>
              </div>

              <section className="space-y-1">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  Beneficiario
                </p>
                <p className="text-sm text-vialto-charcoal font-medium">{transportistaNombre}</p>
              </section>

              <section className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  Período
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="periodoDesde" className="block text-xs text-vialto-steel mb-1">
                      Desde
                    </label>
                    <input
                      id="periodoDesde"
                      type="date"
                      required
                      value={periodoDesde}
                      onChange={(e) => setPeriodoDesde(e.target.value)}
                      className="w-full h-9 border border-black/20 px-3 text-sm focus:outline-none focus:border-vialto-charcoal"
                    />
                  </div>
                  <div>
                    <label htmlFor="periodoHasta" className="block text-xs text-vialto-steel mb-1">
                      Hasta
                    </label>
                    <input
                      id="periodoHasta"
                      type="date"
                      required
                      value={periodoHasta}
                      min={periodoDesde}
                      onChange={(e) => setPeriodoHasta(e.target.value)}
                      className="w-full h-9 border border-black/20 px-3 text-sm focus:outline-none focus:border-vialto-charcoal"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  Viaje incluido
                </p>
                <div className="bg-vialto-mist/50 px-3 py-2 space-y-0.5">
                  <p className="text-xs font-medium text-vialto-charcoal">
                    Viaje #{viaje.numero}
                    {viaje.fechaCarga && (
                      <span className="font-normal text-vialto-steel ml-2">
                        — {fmtDate(viaje.fechaCarga.slice(0, 10))}
                      </span>
                    )}
                  </p>
                  {(viaje.origen || viaje.destino) && (
                    <p className="text-xs text-vialto-steel">
                      {viaje.origen ?? '—'} → {viaje.destino ?? '—'}
                    </p>
                  )}
                  {viaje.precioTransportistaExterno != null && (
                    <p className="text-xs text-vialto-charcoal tabular-nums">
                      Bruto: {fmtMoney(viaje.precioTransportistaExterno)}
                    </p>
                  )}
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  Gastos administrativos (ARS)
                </p>
                {gastosAdminArs.length === 0 ? (
                  <p className="text-xs text-vialto-steel">Sin gastos registrados en este viaje.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {gastosAdminArs.map((g, i) => (
                      <li key={i} className="flex justify-between text-xs text-vialto-charcoal">
                        <span>{g.descripcion}</span>
                        <span className="tabular-nums">${(g.monto ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </li>
                    ))}
                    <li className="flex justify-between text-xs font-medium text-vialto-charcoal border-t border-black/10 pt-1 mt-1">
                      <span>Total gastos</span>
                      <span className="tabular-nums">${totalGastosAdminArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    </li>
                  </ul>
                )}
              </section>

              <section className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                  Comisión
                </p>
                <input
                  id="comisionPct"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={comisionPct}
                  onChange={(e) => setComisionPct(e.target.value)}
                  placeholder={arcaConfig != null ? String(arcaConfig.comisionPctDefault) : ''}
                  className="w-52 h-9 border border-black/20 px-3 text-sm focus:outline-none focus:border-vialto-charcoal"
                />
              </section>

              {error && (
                <p className="text-xs text-red-700 border border-red-200 bg-red-50 px-3 py-2">
                  {error}
                </p>
              )}
              {arcaConfigMissing && (
                <button
                  type="button"
                  onClick={() => { onClose(); navigate('/liquidaciones/configuracion'); }}
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
                    disabled={busyCrear || !periodoDesde || !periodoHasta}
                    onClick={() => void handleCrear()}
                    className="h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90 disabled:opacity-50"
                  >
                    {busyCrear ? 'Creando…' : 'Crear liquidación'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Liquidación creada (borrador) — pendiente de envío a ARCA ── */}
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
                <Row label="Transportista" value={transportistaNombre} />
                <Row label="Período" value={`${fmtDate(liquidacion.periodoDesde.slice(0, 10))} — ${fmtDate(liquidacion.periodoHasta.slice(0, 10))}`} />
                <Row label="Bruto" value={fmtMoney(liquidacion.bruto)} />
                <Row label={`Comisión (${liquidacion.comisionPct}%)`} value={fmtMoney(liquidacion.comision)} />
                <Row label="Gastos admin" value={fmtMoney(liquidacion.gastosAdmin)} />
                <Row label={`IVA gastos (${arcaConfig?.ivaGastosAdmin ?? '—'}%)`} value={fmtMoney(liquidacion.gastosAdminIva)} />
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
                  onClick={onClose}
                  className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={busyArca}
                  onClick={() => void handleEmitirArca()}
                  className="inline-flex items-center gap-2 h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90 disabled:opacity-50"
                >
                  {!busyArca && <Receipt className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />}
                  {busyArca ? 'Enviando a ARCA…' : 'Emitir a ARCA'}
                </button>
              </div>
            </div>
          )}

          {/* ── Autorizado por ARCA ── */}
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
                <Row label="Transportista" value={transportistaNombre} />
                <Row label="Período" value={`${fmtDate(liquidacion.periodoDesde.slice(0, 10))} — ${fmtDate(liquidacion.periodoHasta.slice(0, 10))}`} />
                <Row label="Bruto" value={fmtMoney(liquidacion.bruto)} />
                <Row label={`Comisión (${liquidacion.comisionPct}%)`} value={fmtMoney(liquidacion.comision)} />
                <Row label="Gastos admin" value={fmtMoney(liquidacion.gastosAdmin)} />
                <Row label={`IVA gastos (${arcaConfig?.ivaGastosAdmin ?? '—'}%)`} value={fmtMoney(liquidacion.gastosAdminIva)} />
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
