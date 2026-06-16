import { useState } from 'react';
import {
  parseCurrencyForMoneda,
  preserveAmountOnMonedaChange,
  maskCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { PagoTransportista } from '@/types/api';

export interface PagoTransportistaDraft {
  montoStr: string;
  moneda: ViajeMonedaCodigo;
  fecha: string;
  observaciones: string;
}

export function pagoTransportistaDraftFromApi(p: PagoTransportista): PagoTransportistaDraft {
  return {
    montoStr: p.monto != null ? String(p.monto) : '',
    moneda: p.moneda === 'USD' ? 'USD' : 'ARS',
    fecha: p.fecha ?? new Date().toISOString().slice(0, 10),
    observaciones: p.observaciones ?? '',
  };
}

export function pagoTransportistaDraftToApi(
  d: PagoTransportistaDraft,
): PagoTransportista | null {
  const monto = parseCurrencyForMoneda(d.montoStr, d.moneda);
  if (monto == null || monto <= 0) return null;
  if (!d.fecha.trim()) return null;

  return {
    monto,
    moneda: d.moneda,
    fecha: d.fecha.trim(),
    observaciones: d.observaciones.trim() || undefined,
  };
}

export function emptyPagoTransportista(): PagoTransportistaDraft {
  return {
    montoStr: '',
    moneda: 'ARS',
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

interface Props {
  rows: PagoTransportistaDraft[];
  onChange: (rows: PagoTransportistaDraft[]) => void;
  className?: string;
}

export function PagosTransportistaFieldset({ rows, onChange, className }: Props) {
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

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

      {rows.length === 0 && (
        <p className="text-xs text-vialto-steel">Sin pagos registrados.</p>
      )}

      {rows.map((row, i) => (
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
              onChange={(e) => update(i, { montoStr: maskCurrencyForMoneda(e.target.value, row.moneda) })}
              placeholder="0.00"
              className={`${smallInputClass} text-right tabular-nums lg:w-36`}
              aria-label={`Monto pago ${i + 1}`}
            />
          </div>

          {/* Moneda */}
          <div className="flex flex-col gap-1 lg:w-20">
            {pagoFieldLabel('Moneda', i)}
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
      ))}
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
