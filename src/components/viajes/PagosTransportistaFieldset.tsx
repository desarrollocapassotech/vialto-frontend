import { useState } from 'react';
import {
  maskCurrencyForMoneda,
  parseCurrencyForMoneda,
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
const smallInputClass = 'h-9 border border-black/15 bg-white px-2 text-sm';

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
        <div
          key={i}
          className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end mb-2"
        >
          {/* Observaciones (misma posición que descripción en otros gastos) */}
          <div className="flex flex-col gap-1 min-w-0">
            {i === 0 && <span className={fieldLabelClass}>Observaciones</span>}
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
          <div className="flex flex-col gap-1 w-36">
            {i === 0 && <span className={fieldLabelClass}>Monto</span>}
            <input
              type="text"
              inputMode="decimal"
              value={row.montoStr}
              onChange={(e) =>
                update(i, {
                  montoStr: maskCurrencyForMoneda(e.target.value, row.moneda),
                })
              }
              placeholder={row.moneda === 'USD' ? '0.00' : '0,00'}
              className={`${smallInputClass} w-36 text-right tabular-nums`}
              aria-label={`Monto pago ${i + 1}`}
            />
          </div>

          {/* Moneda */}
          <div className="flex flex-col gap-1 w-20">
            {i === 0 && <span className={fieldLabelClass}>Moneda</span>}
            <select
              value={row.moneda}
              onChange={(e) => {
                const m = e.target.value as ViajeMonedaCodigo;
                update(i, { moneda: m, montoStr: '' });
              }}
              className={`${smallInputClass} w-20`}
              aria-label={`Moneda pago ${i + 1}`}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>

          {/* Fecha */}
          <div className="flex flex-col gap-1 w-36">
            {i === 0 && <span className={fieldLabelClass}>Fecha (opc.)</span>}
            <input
              type="date"
              value={row.fecha}
              onChange={(e) => update(i, { fecha: e.target.value })}
              className={`${smallInputClass} w-36`}
              aria-label={`Fecha pago ${i + 1}`}
            />
          </div>

          {/* Eliminar */}
          <div className="flex flex-col gap-1">
            {i === 0 && <span className={fieldLabelClass}>&nbsp;</span>}
            <button
              type="button"
              onClick={() => setRemoveIndex(i)}
              className="h-9 px-2 border border-red-200 text-red-700 text-xs hover:bg-red-50 active:bg-red-100"
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
