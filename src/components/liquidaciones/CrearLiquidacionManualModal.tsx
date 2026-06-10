import { useEffect, useRef, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { Spinner } from '@/components/ui/Spinner';
import type { Liquidacion, Transportista, Viaje } from '@/types/api';

type ViajeItem = Pick<Viaje, 'id' | 'numero' | 'fechaCarga' | 'origen' | 'destino' | 'precioTransportistaExterno' | 'otrosGastos'>;

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function fmtMoney(n: number | null) {
  if (n == null) return '—';
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
}

const inputClass =
  'h-9 w-full rounded border border-black/15 bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35';
const selectClass = inputClass;
const labelClass =
  'block font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em] text-vialto-steel mb-1';

interface Props {
  /** Si se provee, la liquidación es para este viaje específico (transportista y viaje bloqueados). */
  viajeInicial?: Viaje;
  transportistas: Transportista[];
  getToken: () => Promise<string | null>;
  onSuccess: (liq: Liquidacion) => void;
  onClose: () => void;
}

export function CrearLiquidacionManualModal({
  viajeInicial,
  transportistas,
  getToken,
  onSuccess,
  onClose,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // — Campos del formulario —
  const [transportistaId, setTransportistaId] = useState(viajeInicial?.transportistaId ?? '');
  const [periodoDesde, setPeriodoDesde] = useState('');
  const [periodoHasta, setPeriodoHasta] = useState('');
  const [comisionPct, setComisionPct] = useState('');
  const [ivaPct, setIvaPct] = useState('21');

  // — Selección de viajes (solo cuando no hay viajeInicial) —
  const [viajes, setViajes] = useState<ViajeItem[]>([]);
  const [viajesLoading, setViajesLoading] = useState(false);
  const [selectedViajeIds, setSelectedViajeIds] = useState<Set<string>>(
    viajeInicial ? new Set([viajeInicial.id]) : new Set(),
  );

  // — Estado del submit —
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar viajes cuando cambia el transportista seleccionado (modo sin viajeInicial)
  useEffect(() => {
    if (viajeInicial || !transportistaId) {
      setViajes([]);
      return;
    }
    let cancelled = false;
    setViajesLoading(true);
    setSelectedViajeIds(new Set());
    void (async () => {
      try {
        const res = await apiJson<{ items: ViajeItem[] }>(
          `/api/viajes/paginated?transportistaId=${encodeURIComponent(transportistaId)}&pageSize=100&page=1`,
          () => getToken(),
        );
        if (!cancelled) setViajes(res.items ?? []);
      } catch {
        if (!cancelled) setViajes([]);
      } finally {
        if (!cancelled) setViajesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [transportistaId, viajeInicial, getToken]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [submitting, onClose]);

  function toggleViaje(id: string) {
    setSelectedViajeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodoDesde || !periodoHasta) return;
    const viajeIds = viajeInicial ? [viajeInicial.id] : Array.from(selectedViajeIds);
    if (viajeIds.length === 0) {
      setError('Seleccioná al menos un viaje.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        transportistaId,
        periodoDesde,
        periodoHasta,
        viajeIds,
      };
      if (comisionPct.trim() !== '') body.comisionPct = Number(comisionPct);
      if (ivaPct.trim() !== '') body.ivaPct = Number(ivaPct);
      const liq = await apiJson<Liquidacion>(
        '/api/integracion-arca/liquidaciones',
        () => getToken(),
        { method: 'POST', body: JSON.stringify(body) },
      );
      onSuccess(liq);
    } catch (err) {
      setError(friendlyError(err, 'arca'));
    } finally {
      setSubmitting(false);
    }
  }

  const transportistaNombre =
    transportistas.find((t) => t.id === transportistaId)?.nombre ??
    viajeInicial?.transportista?.nombre ??
    transportistaId;

  // — Resumen de montos —
  const selectedViajes = viajeInicial
    ? [viajeInicial as ViajeItem]
    : viajes.filter((v) => selectedViajeIds.has(v.id));
  const anyHasPrice = selectedViajes.some((v) => v.precioTransportistaExterno != null);
  const bruto = selectedViajes.reduce((sum, v) => sum + (v.precioTransportistaExterno ?? 0), 0);
  const gastosAdmin = selectedViajes.reduce(
    (sum, v) =>
      sum +
      (v.otrosGastos ?? [])
        .filter((g) => (g.moneda ?? 'ARS') === 'ARS')
        .reduce((a, g) => a + (g.monto ?? 0), 0),
    0,
  );
  const comisionNum = comisionPct.trim() !== '' ? Number(comisionPct) : null;
  const comisionMonto = comisionNum !== null && anyHasPrice ? (bruto * comisionNum) / 100 : null;
  const netoGravado = comisionMonto !== null ? bruto - comisionMonto - gastosAdmin : null;
  const ivaPctNum = ivaPct.trim() !== '' ? Number(ivaPct) : 21;
  const ivaMonto = netoGravado !== null ? (netoGravado * ivaPctNum) / 100 : null;
  const totalALiquidar = netoGravado !== null && ivaMonto !== null ? netoGravado + ivaMonto : null;
  const showSummary = anyHasPrice && (viajeInicial != null || selectedViajeIds.size > 0);

  const canSubmit =
    Boolean(transportistaId) &&
    Boolean(periodoDesde) &&
    Boolean(periodoHasta) &&
    (viajeInicial ? true : selectedViajeIds.size > 0);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current && !submitting) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg bg-white border border-black/10 shadow-xl flex flex-col max-h-[90dvh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 shrink-0">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
            Nueva liquidación
          </h2>
          {!submitting && (
            <button type="button" onClick={onClose} className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none">×</button>
          )}
        </div>

        {/* Body */}
        <form onSubmit={(e) => void handleSubmit(e)} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Transportista */}
          <div>
            <label className={labelClass}>Transportista <span className="text-red-500">*</span></label>
            {viajeInicial ? (
              <div className="rounded border border-black/10 bg-vialto-mist px-3 py-2 text-sm text-vialto-charcoal">
                {transportistaNombre}
              </div>
            ) : (
              <select
                required
                value={transportistaId}
                onChange={(e) => setTransportistaId(e.target.value)}
                className={selectClass}
              >
                <option value="">— Seleccioná un transportista —</option>
                {transportistas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            )}
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="periodoDesde" className={labelClass}>Desde <span className="text-red-500">*</span></label>
              <input
                id="periodoDesde"
                type="date"
                required
                value={periodoDesde}
                onChange={(e) => setPeriodoDesde(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="periodoHasta" className={labelClass}>Hasta <span className="text-red-500">*</span></label>
              <input
                id="periodoHasta"
                type="date"
                required
                min={periodoDesde}
                value={periodoHasta}
                onChange={(e) => setPeriodoHasta(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Comisión e IVA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="comisionPct" className={labelClass}>Comisión (%)</label>
              <input
                id="comisionPct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={comisionPct}
                onChange={(e) => setComisionPct(e.target.value)}
                placeholder="Default del transportista"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="ivaPct" className={labelClass}>IVA (%) <span className="text-red-500">*</span></label>
              <input
                id="ivaPct"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={ivaPct}
                onChange={(e) => setIvaPct(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Viaje pre-fijado */}
          {viajeInicial && (
            <div>
              <p className={labelClass}>Viaje incluido</p>
              <div className="rounded border border-black/10 bg-vialto-mist px-3 py-2 space-y-0.5">
                <p className="text-sm font-medium text-vialto-charcoal">
                  Viaje #{viajeInicial.numero}
                  {viajeInicial.fechaCarga && (
                    <span className="font-normal text-vialto-steel ml-2">
                      — {fmtDate(viajeInicial.fechaCarga)}
                    </span>
                  )}
                </p>
                {(viajeInicial.origen || viajeInicial.destino) && (
                  <p className="text-xs text-vialto-steel">
                    {viajeInicial.origen ?? '—'} → {viajeInicial.destino ?? '—'}
                  </p>
                )}
                {viajeInicial.precioTransportistaExterno != null && (
                  <p className="text-xs text-vialto-charcoal tabular-nums">
                    Bruto: {fmtMoney(viajeInicial.precioTransportistaExterno)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Selección de viajes (modo sin viajeInicial) */}
          {!viajeInicial && transportistaId && (
            <div>
              <p className={labelClass}>
                Viajes a incluir <span className="text-red-500">*</span>
                {selectedViajeIds.size > 0 && (
                  <span className="ml-1 normal-case text-vialto-charcoal">
                    ({selectedViajeIds.size} seleccionado{selectedViajeIds.size !== 1 ? 's' : ''})
                  </span>
                )}
              </p>
              {viajesLoading ? (
                <div className="flex items-center gap-2 py-3 text-xs text-vialto-steel">
                  <Spinner /> Cargando viajes…
                </div>
              ) : viajes.length === 0 ? (
                <p className="text-xs text-vialto-steel py-2">
                  No hay viajes registrados para este transportista.
                </p>
              ) : (
                <div className="max-h-44 overflow-y-auto rounded border border-black/10 divide-y divide-black/5">
                  {viajes.map((v) => (
                    <label
                      key={v.id}
                      className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-vialto-mist/60"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 shrink-0"
                        checked={selectedViajeIds.has(v.id)}
                        onChange={() => toggleViaje(v.id)}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-vialto-charcoal">
                          Viaje #{v.numero}
                          {v.fechaCarga && (
                            <span className="font-normal text-vialto-steel ml-1.5">
                              {fmtDate(v.fechaCarga)}
                            </span>
                          )}
                        </p>
                        {(v.origen || v.destino) && (
                          <p className="text-[11px] text-vialto-steel truncate">
                            {v.origen ?? '—'} → {v.destino ?? '—'}
                          </p>
                        )}
                        {v.precioTransportistaExterno != null && (
                          <p className="text-[11px] text-vialto-charcoal tabular-nums">
                            {fmtMoney(v.precioTransportistaExterno)}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Resumen de montos */}
          {showSummary && (
            <div className="rounded border border-black/10 bg-vialto-mist/60 px-4 py-3 space-y-1.5">
              <div className="flex justify-between items-baseline">
                <span className={labelClass}>Sub Total</span>
                <span className="tabular-nums text-sm font-medium text-vialto-charcoal">{fmtMoney(bruto)}</span>
              </div>
              {comisionMonto !== null && (
                <div className="flex justify-between items-baseline text-xs text-vialto-steel">
                  <span>Comisión {comisionNum}%</span>
                  <span className="tabular-nums">− {fmtMoney(comisionMonto)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline text-xs text-vialto-steel">
                <span>Otras</span>
                <span className="tabular-nums">{gastosAdmin > 0 ? `− ${fmtMoney(gastosAdmin)}` : '—'}</span>
              </div>
              {netoGravado !== null && (
                <div className="flex justify-between items-baseline border-t border-black/10 pt-1.5">
                  <span className={labelClass}>Neto gravado</span>
                  <span className="tabular-nums text-sm font-medium text-vialto-charcoal">{fmtMoney(netoGravado)}</span>
                </div>
              )}
              {ivaMonto !== null && (
                <div className="flex justify-between items-baseline text-xs text-vialto-steel">
                  <span>IVA {ivaPctNum}%</span>
                  <span className="tabular-nums">+ {fmtMoney(ivaMonto)}</span>
                </div>
              )}
              {totalALiquidar !== null && (
                <div className="flex justify-between items-baseline border-t border-black/10 pt-1.5">
                  <span className={labelClass}>Total neto a liquidar</span>
                  <span className="tabular-nums text-base font-semibold text-vialto-charcoal">{fmtMoney(totalALiquidar)}</span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-black/10 px-6 py-4 shrink-0">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="h-9 px-4 rounded border border-black/20 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form=""
            disabled={submitting || !canSubmit}
            onClick={(e) => void handleSubmit(e as unknown as React.FormEvent)}
            className="inline-flex items-center gap-2 h-9 px-5 rounded bg-vialto-charcoal font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-white hover:bg-vialto-charcoal/90 disabled:opacity-50"
          >
            {submitting && <Spinner />}
            {submitting ? 'Creando…' : 'Crear liquidación'}
          </button>
        </div>
      </div>
    </div>
  );
}
