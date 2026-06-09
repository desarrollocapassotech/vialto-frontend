import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { Spinner } from '@/components/ui/Spinner';
import type { Liquidacion } from '@/types/api';

type LiquidacionConTransportista = Liquidacion & {
  transportista?: { id: string; nombre: string; idFiscal: string | null } | null;
};

const CBTE_TIPO: Record<number, string> = {
  60: 'Tipo 60 — Liquidación CVLP',
  1: 'Factura A',
  6: 'Factura B',
};

function fmtMoney(n: number) {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function Fila({
  label,
  value,
  muted,
  bold,
  separator,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  bold?: boolean;
  separator?: boolean;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${separator ? 'border-t border-black/10 mt-1' : 'border-b border-black/5 last:border-0'}`}>
      <span className={`text-xs ${muted ? 'text-vialto-steel' : bold ? 'font-medium text-vialto-charcoal' : 'text-vialto-charcoal'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-semibold text-vialto-charcoal' : muted ? 'text-vialto-steel' : 'text-vialto-charcoal'}`}>
        {value}
      </span>
    </div>
  );
}

export function EmitirLiquidacionModal({
  liq,
  getToken,
  onSuccess,
  onClose,
  emitirUrl,
  ivaPct,
}: {
  liq: LiquidacionConTransportista;
  getToken: () => Promise<string | null>;
  onSuccess: (updated: LiquidacionConTransportista) => void;
  onClose: () => void;
  /** URL del endpoint de emisión. Por defecto usa el endpoint de tenant. */
  emitirUrl?: string;
  /** Porcentaje de IVA configurado (ej: 21). Si no se pasa, se deduce de los valores guardados. */
  ivaPct?: number;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [submitting, onClose]);

  async function confirmar() {
    setSubmitting(true);
    setError(null);
    try {
      const url = emitirUrl ?? `/api/liquidaciones-arca/liquidaciones/${encodeURIComponent(liq.id)}/emitir`;
      const updated = await apiJson<LiquidacionConTransportista>(
        url,
        () => getToken(),
        { method: 'POST' },
      );
      onSuccess({ ...updated, transportista: liq.transportista });
    } catch (e) {
      setError(friendlyError(e, 'arca'));
    } finally {
      setSubmitting(false);
    }
  }

  const cbteTipoLabel = CBTE_TIPO[liq.cbteTipo] ?? `Tipo ${liq.cbteTipo}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded border border-black/10 bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
            Emitir comprobante
          </h2>
          {!submitting && (
            <button
              type="button"
              onClick={onClose}
              className="text-vialto-steel hover:text-vialto-charcoal"
              aria-label="Cerrar"
            >
              ✕
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Datos del emisor */}
          <div>
            <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel mb-2">
              Destinatario
            </p>
            <div className="rounded border border-black/10 bg-vialto-mist px-4 py-3">
              <p className="font-medium text-vialto-charcoal">
                {liq.transportista?.nombre ?? liq.transportistaId}
              </p>
              {liq.transportista?.idFiscal && (
                <p className="text-xs text-vialto-steel mt-0.5">
                  CUIT {liq.transportista.idFiscal}
                </p>
              )}
            </div>
          </div>

          {/* Detalle financiero */}
          <div>
            <p className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel mb-2">
              Detalle del comprobante
            </p>
            <div className="rounded border border-black/10 bg-white px-4 py-1">
              <Fila label="Período" value={`${fmtDate(liq.periodoDesde)} — ${fmtDate(liq.periodoHasta)}`} muted />
              <Fila label="Viajes" value={liq.cantViajes} muted />
              <Fila label="Sub total" value={fmtMoney(liq.bruto)} />
              <Fila label={`Comisión según convenio ${liq.comisionPct}%`} value={fmtMoney(liq.comision)} muted />
              {liq.gastosAdmin > 0 && (
                <Fila label="Otras" value={fmtMoney(liq.gastosAdmin)} muted />
              )}
              {(() => {
                // Base del IVA = bruto - comision (los gastos admin van al 0%)
                const ivaBase = liq.bruto - liq.comision;
                const ivaLabel = ivaPct != null ? `IVA ${ivaPct}%` : 'IVA';
                return (
                  <>
                    <Fila label="Sub total" value={fmtMoney(ivaBase)} separator />
                    <Fila label={ivaLabel} value={fmtMoney(liq.gastosAdminIva)} muted />
                    <Fila label="Total neto a liquidar" value={fmtMoney(liq.liquido)} bold separator />
                  </>
                );
              })()}
            </div>
          </div>

          {/* Tipo comprobante */}
          <div className="flex items-center justify-between rounded border border-black/10 bg-white px-4 py-2.5">
            <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.2em] text-vialto-steel">
              Comprobante
            </span>
            <span className="text-sm text-vialto-charcoal">{cbteTipoLabel}</span>
          </div>

          {/* Advertencia */}
          <div className="rounded border border-amber-400/40 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            Al confirmar se enviará el comprobante a ARCA para su autorización. Una vez emitido no puede modificarse.
          </div>

          {/* Error */}
          {error && (
            <div className="rounded border border-red-300/50 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-black/10 px-6 py-4">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="h-9 px-4 rounded border border-black/20 font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={confirmar}
            className="inline-flex items-center gap-2 h-9 px-5 rounded bg-vialto-fire font-[family-name:var(--font-ui)] text-xs uppercase tracking-wider text-white hover:bg-vialto-bright disabled:opacity-50"
          >
            {submitting ? <Spinner /> : <Receipt className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />}
            {submitting ? 'Emitiendo…' : 'Emitir comprobante'}
          </button>
        </div>
      </div>
    </div>
  );
}
