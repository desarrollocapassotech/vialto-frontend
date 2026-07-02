import { useMemo, useState } from 'react';
import {
  formatNumberForMoneda,
  parseCurrencyForMoneda,
  preserveAmountOnMonedaChange,
  maskCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { isoToFechaHora } from '@/lib/viajeFechaHora';
import { formatViajeImporteForListado } from '@/lib/viajesFlota';
import {
  PAGO_TRANSPORTISTA_SALDO_ERROR,
  calcularSaldoTransportistaDesdeDraft,
  validarPagosTransportistaDraftForm,
  type PagosTransportistaDraftFormInput,
} from '@/lib/viajesTransportistaPagos';
import type { PagoTransportista } from '@/types/api';

function fechaPagoToInputValue(fecha: string | undefined | null): string {
  const t = fecha?.trim();
  if (!t) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const { fecha: local } = isoToFechaHora(t);
  return local || new Date().toISOString().slice(0, 10);
}

export interface PagoTransportistaDraft {
  montoStr: string;
  moneda: ViajeMonedaCodigo;
  fecha: string;
  observaciones: string;
}

export function pagoTransportistaDraftFromApi(p: PagoTransportista): PagoTransportistaDraft {
  const moneda: ViajeMonedaCodigo = p.moneda === 'USD' ? 'USD' : 'ARS';
  return {
    montoStr: p.monto != null ? formatNumberForMoneda(p.monto, moneda) : '',
    moneda,
    fecha: fechaPagoToInputValue(p.fecha),
    observaciones: p.observaciones ?? '',
  };
}

export function pagoTransportistaDraftToApi(
  d: PagoTransportistaDraft,
): PagoTransportista | null {
  const monto = parseCurrencyForMoneda(d.montoStr, d.moneda);
  if (monto == null || monto <= 0) return null;

  const fechaRaw = d.fecha.trim();
  const fecha =
    (fechaRaw ? fechaPagoToInputValue(fechaRaw) : null) ??
    new Date().toISOString().slice(0, 10);

  return {
    monto,
    moneda: d.moneda,
    fecha,
    observaciones: d.observaciones.trim() || undefined,
  };
}

export function pagosTransportistaDraftsToApi(
  rows: PagoTransportistaDraft[],
): PagoTransportista[] {
  return rows
    .map(pagoTransportistaDraftToApi)
    .filter((p): p is PagoTransportista => p != null);
}

export function emptyPagoTransportista(moneda: ViajeMonedaCodigo = 'ARS'): PagoTransportistaDraft {
  return {
    montoStr: '',
    moneda,
    fecha: new Date().toISOString().slice(0, 10),
    observaciones: '',
  };
}

const fieldLabelClass =
  'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';
const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const smallInputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const pagoRowGridClass =
  'grid grid-cols-1 gap-4 mb-6 border-b border-black/10 pb-4 last:mb-4 last:border-0 last:pb-0 lg:mb-2 lg:grid-cols-[1fr_auto_auto_auto_auto] lg:items-end lg:gap-2 lg:border-0 lg:pb-0';

function pagoFieldLabel(label: string, rowIndex: number) {
  return (
    <span className={`${fieldLabelClass} ${rowIndex > 0 ? 'lg:hidden' : ''}`}>{label}</span>
  );
}

export type PagosTransportistaSaldoContext = Omit<
  PagosTransportistaDraftFormInput,
  'pagosTransportista'
>;

interface Props {
  rows: PagoTransportistaDraft[];
  onChange: (rows: PagoTransportistaDraft[]) => void;
  className?: string;
  /** Activa saldo en tiempo real y validación (crear/editar viaje con transportista externo). */
  saldoContext?: PagosTransportistaSaldoContext | null;
}

export function PagosTransportistaFieldset({ rows, onChange, className, saldoContext }: Props) {
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const monedaAcordada = saldoContext
    ? (saldoContext.monedaPrecioTransportistaExterno === 'USD' ? 'USD' : 'ARS')
    : null;

  const draftFormInput = useMemo((): PagosTransportistaDraftFormInput | null => {
    if (!saldoContext) return null;
    const monedaFija = saldoContext.monedaPrecioTransportistaExterno === 'USD' ? 'USD' : 'ARS';
    return {
      ...saldoContext,
      pagosTransportista: rows.map((r) => ({ ...r, moneda: monedaFija })),
    };
  }, [saldoContext, rows]);

  const saldo = useMemo(
    () => (draftFormInput ? calcularSaldoTransportistaDesdeDraft(draftFormInput) : null),
    [draftFormInput],
  );

  const saldoError = useMemo(
    () => (draftFormInput ? validarPagosTransportistaDraftForm(draftFormInput) : null),
    [draftFormInput],
  );

  const saldoExcedido = saldoError === PAGO_TRANSPORTISTA_SALDO_ERROR;

  function update(i: number, patch: Partial<PagoTransportistaDraft>) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  }

  function confirmRemove() {
    if (removeIndex === null) return;
    const i = removeIndex;
    setRemoveIndex(null);
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className={className}>
      <div className="mb-2">
        <span className={fieldLabelClass}>Pagos al transportista</span>
      </div>

      {saldo && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded border border-black/10 bg-vialto-mist/60 px-3 py-2 text-xs">
          <span className="text-vialto-steel">
            Acordado:{' '}
            <span className="font-medium text-vialto-charcoal">
              {formatViajeImporteForListado(saldo.totalAcordado, saldo.moneda)}
            </span>
          </span>
          <span className="text-vialto-steel">
            Pagado:{' '}
            <span className="font-medium text-vialto-charcoal tabular-nums">
              {formatViajeImporteForListado(saldo.totalPagado, saldo.moneda)}
            </span>
          </span>
          <span className="text-vialto-steel">
            Saldo:{' '}
            <span
              className={`font-medium tabular-nums ${
                saldoExcedido ? 'text-red-700' : saldo.pagado ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {saldoExcedido
                ? formatViajeImporteForListado(Math.max(0, saldo.saldo), saldo.moneda)
                : saldo.pagado
                  ? 'Pagado'
                  : formatViajeImporteForListado(saldo.saldo, saldo.moneda)}
            </span>
          </span>
        </div>
      )}

      {saldoError && (
        <p
          role="alert"
          className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          {saldoError}
        </p>
      )}

      {rows.length === 0 && (
        <p className="text-xs text-vialto-steel">Sin pagos registrados.</p>
      )}

      {rows.map((row, i) => {
        const monedaFila = monedaAcordada ?? row.moneda;
        return (
        <div key={i} className={pagoRowGridClass}>
          {/* Observaciones (misma posición que descripción en otros gastos) */}
          <div className="flex min-w-0 flex-col gap-1">
            {pagoFieldLabel('Observaciones', i)}
            <input
              type="text"
              value={row.observaciones}
              onChange={(e) => update(i, { observaciones: e.target.value })}
              placeholder="Ej. transferencia, comprobante…"
              className={inputClass}
              aria-label={`Observaciones pago ${i + 1}`}
            />
          </div>

          {/* Monto */}
          <div className="flex flex-col gap-1 lg:w-36">
            {pagoFieldLabel('Monto', i)}
            <input
              type="text"
              inputMode="decimal"
              value={row.montoStr}
              onChange={(e) =>
                update(i, {
                  montoStr: maskCurrencyForMoneda(e.target.value, monedaFila),
                  ...(monedaAcordada ? { moneda: monedaAcordada } : {}),
                })
              }
              placeholder="0.00"
              className={`${smallInputClass} text-right tabular-nums lg:w-36 ${
                saldoExcedido && row.montoStr.trim() ? 'border-red-400' : ''
              }`}
              aria-label={`Monto pago ${i + 1}`}
              aria-invalid={saldoExcedido && row.montoStr.trim() ? true : undefined}
            />
            {saldoExcedido && row.montoStr.trim() ? (
              <CrudFieldError message={PAGO_TRANSPORTISTA_SALDO_ERROR} />
            ) : null}
          </div>

          {/* Moneda */}
          <div className="flex flex-col gap-1 lg:w-20">
            {pagoFieldLabel('Moneda', i)}
            {monedaAcordada ? (
              <span className="flex h-9 items-center text-sm font-medium text-vialto-charcoal lg:w-20">
                {monedaAcordada}
              </span>
            ) : (
              <select
                value={row.moneda}
                onChange={(e) => {
                  const m = e.target.value as ViajeMonedaCodigo;
                  update(i, {
                    moneda: m,
                    montoStr: preserveAmountOnMonedaChange(row.montoStr, row.moneda, m),
                  });
                }}
                className={`${smallInputClass} lg:w-20`}
                aria-label={`Moneda pago ${i + 1}`}
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            )}
          </div>

          {/* Fecha */}
          <div className="flex flex-col gap-1 lg:w-36">
            {pagoFieldLabel('Fecha (opc.)', i)}
            <input
              type="date"
              value={row.fecha}
              onChange={(e) => update(i, { fecha: e.target.value })}
              className={`${smallInputClass} lg:w-36`}
              aria-label={`Fecha pago ${i + 1}`}
            />
          </div>

          {/* Eliminar */}
          <div className="flex flex-col gap-1">
            {i === 0 ? (
              <span className={`${fieldLabelClass} hidden lg:block`}>&nbsp;</span>
            ) : (
              pagoFieldLabel('Eliminar', i)
            )}
            <button
              type="button"
              onClick={() => setRemoveIndex(i)}
              className="h-9 w-full px-2 border border-red-200 text-red-700 text-xs hover:bg-red-50 active:bg-red-100 lg:w-auto"
              aria-label={`Eliminar pago ${i + 1}`}
            >
              ✕
            </button>
          </div>
        </div>
        );
      })}
      <ConfirmDialog
        open={removeIndex !== null}
        title="Eliminar pago"
        message="¿Eliminás este pago al transportista de la lista?"
        confirmLabel="Eliminar"
        tone="danger"
        onCancel={() => setRemoveIndex(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
