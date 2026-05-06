import { useState } from 'react';
import {
  maskCurrencyForMoneda,
  parseCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { OtroGasto } from '@/types/api';

export interface OtroGastoDraft {
  descripcion: string;
  montoStr: string;
  moneda: ViajeMonedaCodigo;
  fecha: string;
}

export function otroGastoDraftFromApi(g: OtroGasto): OtroGastoDraft {
  return {
    descripcion: g.descripcion,
    montoStr: String(g.monto),
    moneda: g.moneda === 'USD' ? 'USD' : 'ARS',
    fecha: g.fecha ?? '',
  };
}

export function otroGastoDraftToApi(
  d: OtroGastoDraft,
): OtroGasto | null {
  const monto = parseCurrencyForMoneda(d.montoStr, d.moneda);
  if (!d.descripcion.trim() || monto == null || monto < 0) return null;
  const out: OtroGasto = {
    descripcion: d.descripcion.trim(),
    monto,
    moneda: d.moneda,
  };
  if (d.fecha.trim()) out.fecha = d.fecha.trim();
  return out;
}

export function emptyOtroGasto(): OtroGastoDraft {
  return { descripcion: '', montoStr: '', moneda: 'ARS', fecha: '' };
}

const fieldLabelClass =
  'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';
const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const smallInputClass = 'h-9 border border-black/15 bg-white px-2 text-sm';

interface Props {
  rows: OtroGastoDraft[];
  onChange: (rows: OtroGastoDraft[]) => void;
  /** Extra CSS classes for the wrapper */
  className?: string;
}

export function OtrosGastosFieldset({ rows, onChange, className }: Props) {
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);

  function update(i: number, patch: Partial<OtroGastoDraft>) {
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
        <span className={fieldLabelClass}>Otros gastos</span>
      </div>

      {rows.length === 0 && (
        <p className="text-xs text-vialto-steel">Sin otros gastos cargados.</p>
      )}

      {rows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end mb-2"
        >
          {/* Descripción */}
          <div className="flex flex-col gap-1 min-w-0">
            {i === 0 && <span className={fieldLabelClass}>Descripción</span>}
            <input
              type="text"
              value={row.descripcion}
              onChange={(e) => update(i, { descripcion: e.target.value })}
              placeholder="Ej. Peaje, estadía…"
              className={inputClass}
              aria-label={`Descripción gasto ${i + 1}`}
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
              aria-label={`Monto gasto ${i + 1}`}
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
              aria-label={`Moneda gasto ${i + 1}`}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>

          {/* Fecha (opcional) */}
          <div className="flex flex-col gap-1 w-36">
            {i === 0 && <span className={fieldLabelClass}>Fecha (opc.)</span>}
            <input
              type="date"
              value={row.fecha}
              onChange={(e) => update(i, { fecha: e.target.value })}
              className={`${smallInputClass} w-36`}
              aria-label={`Fecha gasto ${i + 1}`}
            />
          </div>

          {/* Eliminar */}
          <div className="flex flex-col gap-1">
            {i === 0 && <span className={fieldLabelClass}>&nbsp;</span>}
            <button
              type="button"
              onClick={() => setRemoveIndex(i)}
              className="h-9 px-2 border border-red-200 text-red-700 text-xs hover:bg-red-50 active:bg-red-100"
              aria-label={`Eliminar gasto ${i + 1}`}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={removeIndex !== null}
        title="Eliminar gasto"
        message="¿Eliminás este gasto de la lista?"
        confirmLabel="Eliminar"
        tone="danger"
        onCancel={() => setRemoveIndex(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
