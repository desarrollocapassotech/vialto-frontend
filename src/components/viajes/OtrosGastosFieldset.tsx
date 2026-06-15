import { useState } from 'react';
import {
  parseCurrencyForMoneda,
  preserveAmountOnMonedaChange,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import { resolveClerkUserLabel } from '@/lib/clerkUserLabels';
import { useOrgUserLabels } from '@/hooks/useOrgUserLabels';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { OtroGasto } from '@/types/api';

export type OtroGastoAutor = { id: string; label: string };

export interface OtroGastoDraft {
  descripcion: string;
  montoStr: string;
  moneda: ViajeMonedaCodigo;
  fecha: string;
  createdBy?: string;
  createdByLabel?: string | null;
}

export function otroGastoAutorFromClerk(
  user: {
    id: string;
    fullName?: string | null;
    primaryEmailAddress?: { emailAddress?: string } | null;
  } | null | undefined,
): OtroGastoAutor | undefined {
  if (!user?.id) return undefined;
  const label =
    user.fullName?.trim() ||
    user.primaryEmailAddress?.emailAddress ||
    user.id;
  return { id: user.id, label };
}

export function formatOtroGastoAutor(
  row: Pick<OtroGastoDraft, 'createdBy' | 'createdByLabel'>,
  labelMap?: ReadonlyMap<string, string>,
): string {
  return resolveClerkUserLabel(row.createdBy, labelMap, row.createdByLabel);
}

type OtroGastoAutorRow = Pick<OtroGastoDraft, 'createdBy' | 'createdByLabel'>;

/** Muestra el autor con truncado y tooltip al hover/focus para nombres largos. */
export function OtroGastoAutorDisplay({
  row,
  labelMap,
  className = '',
  variant = 'inline',
  'aria-label': ariaLabel,
}: {
  row: OtroGastoAutorRow;
  labelMap?: ReadonlyMap<string, string>;
  className?: string;
  /** `field` = celda read-only del formulario; `inline` = tablas y modal historial */
  variant?: 'field' | 'inline';
  'aria-label'?: string;
}) {
  const label = formatOtroGastoAutor(row, labelMap);
  const showTip = label !== '—';

  const shellClass =
    variant === 'field'
      ? 'h-9 flex min-w-0 items-center border border-black/10 bg-vialto-mist/50 px-2 text-sm text-vialto-charcoal'
      : 'min-w-0 text-inherit';

  return (
    <div
      className={`group relative min-w-0 outline-none ${shellClass} ${className}`}
      title={showTip ? label : undefined}
      tabIndex={showTip ? 0 : undefined}
      aria-label={ariaLabel}
    >
      <span className="block min-w-0 truncate cursor-default">{label}</span>
      {showTip && (
        <div
          role="tooltip"
          className="pointer-events-none invisible absolute bottom-full left-0 z-30 mb-1 max-w-[min(16rem,calc(100vw-2rem))] rounded border border-black/10 bg-vialto-charcoal px-2 py-1.5 text-xs font-normal leading-snug text-white shadow-md whitespace-normal break-words opacity-0 transition-[opacity,visibility] group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
        >
          {label}
        </div>
      )}
    </div>
  );
}

export function otroGastoDraftFromApi(g: OtroGasto): OtroGastoDraft {
  return {
    descripcion: g.descripcion,
    montoStr: String(g.monto),
    moneda: g.moneda === 'USD' ? 'USD' : 'ARS',
    fecha: g.fecha ?? '',
    createdBy: g.createdBy,
    createdByLabel: g.createdByLabel,
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
  if (d.createdBy?.trim()) out.createdBy = d.createdBy.trim();
  return out;
}

export function emptyOtroGasto(autor?: OtroGastoAutor): OtroGastoDraft {
  return {
    descripcion: '',
    montoStr: '',
    moneda: 'ARS',
    fecha: '',
    ...(autor
      ? { createdBy: autor.id, createdByLabel: autor.label }
      : {}),
  };
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
  /** Clerk org id para resolver nombres en vista superadmin. */
  tenantId?: string;
}

export function OtrosGastosFieldset({ rows, onChange, className, tenantId }: Props) {
  const userLabelMap = useOrgUserLabels(tenantId);
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
          className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(7rem,11rem)_auto] gap-2 items-end mb-2"
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
              onChange={(e) => update(i, { montoStr: e.target.value })}
              placeholder="0.00"
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
                update(i, {
                  moneda: m,
                  montoStr: preserveAmountOnMonedaChange(row.montoStr, row.moneda, m),
                });
              }}
              className={`${smallInputClass} w-20`}
              aria-label={`Moneda gasto ${i + 1}`}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>

          {/* Fecha */}
          <div className="flex flex-col gap-1 w-36">
            {i === 0 && <span className={fieldLabelClass}>Fecha</span>}
            <input
              type="date"
              value={row.fecha}
              onChange={(e) => update(i, { fecha: e.target.value })}
              className={`${smallInputClass} w-36`}
              aria-label={`Fecha gasto ${i + 1}`}
            />
          </div>

          {/* Cargado por (solo lectura) */}
          <div className="flex flex-col gap-1 min-w-0">
            {i === 0 && <span className={fieldLabelClass}>Cargado por</span>}
            <OtroGastoAutorDisplay
              row={row}
              labelMap={userLabelMap}
              variant="field"
              aria-label={`Usuario que cargó el gasto ${i + 1}`}
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
