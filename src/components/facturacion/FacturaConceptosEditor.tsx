import { Trash2 } from "lucide-react";
import { marcarModalModificado } from "@/lib/descarteModal";
import { maskCurrencyArInput } from "@/lib/currencyMask";
import {
  cantidadDraft,
  conceptoDesdeDraft,
  emptyFacturaConcepto,
  subtotalConIvaDraft,
  unitarioDraft,
  type FacturaConceptoDraft,
} from "@/lib/facturaConceptos";

/** Máximo de conceptos por factura (mismo límite que el backend). */
const FACTURA_CONCEPTOS_MAX = 30;

// Mismo estilo que `ConceptosLiquidacionLineasEditor` (conceptos de liquidación).
const inputClass =
  "h-9 w-full rounded border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35";
const labelClass =
  "block font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em] text-vialto-steel mb-1";

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Conceptos de la factura además de los viajes (nov 2026). Mismo formato que los conceptos de
 * liquidación: Concepto · Cantidad · Monto unitario · IVA (%) · Subtotal c/IVA y el tacho para
 * quitar. Diferencias: el concepto es texto libre (sin catálogo) y solo suman (sin
 * "Operación"). Se precargan con los gastos de los viajes elegidos.
 */
export function FacturaConceptosEditor({
  conceptos,
  onChange,
  ivaPctDefault,
  incompletos = [],
  onIncompletos,
  disabled,
}: {
  conceptos: FacturaConceptoDraft[];
  onChange: (conceptos: FacturaConceptoDraft[]) => void;
  /** IVA con el que arranca un concepto nuevo (el de la factura). */
  ivaPctDefault: number;
  /** Índices a marcar en rojo (a medio cargar al guardar o al querer agregar otro). */
  incompletos?: number[];
  /**
   * "+ Agregar concepto" con conceptos sin completar: no agrega otro y avisa cuáles (el host
   * los marca en rojo y muestra el aviso en el pie, como al guardar).
   */
  onIncompletos?: (indices: number[]) => void;
  disabled?: boolean;
}) {
  const llegoAlMaximo = conceptos.length >= FACTURA_CONCEPTOS_MAX;
  const incompletoSet = new Set(incompletos);

  function agregar() {
    // No se suma otro renglón mientras haya uno sin completar (vacío o a medio cargar).
    const sinCompletar = conceptos.flatMap((c, i) =>
      conceptoDesdeDraft(c, ivaPctDefault) === null ? [i] : [],
    );
    if (sinCompletar.length > 0) {
      onIncompletos?.(sinCompletar);
      return;
    }
    // Agregar/quitar es solo un click (sin input/change): avisar al modal que hubo cambios.
    marcarModalModificado();
    onChange([...conceptos, emptyFacturaConcepto(ivaPctDefault)]);
  }

  function quitar(index: number) {
    marcarModalModificado();
    onChange(conceptos.filter((_, i) => i !== index));
  }

  function patch(index: number, p: Partial<FacturaConceptoDraft>) {
    onChange(conceptos.map((c, i) => (i === index ? { ...c, ...p } : c)));
  }

  return (
    <div className="space-y-3">
      <p className={`${labelClass} mb-0`}>Conceptos</p>

      {conceptos.length > 0 && (
        <div className="space-y-2">
          {conceptos.map((c, index) => {
            const marcar = incompletoSet.has(index);
            const faltaConcepto = marcar && !c.descripcion.trim();
            const faltaCantidad = marcar && !(cantidadDraft(c) > 0);
            const faltaUnitario = marcar && !faltaCantidad && !(unitarioDraft(c) > 0);
            return (
              <div
                key={index}
                className={`grid grid-cols-1 gap-2 border p-2 sm:grid-cols-[1fr_5rem_8rem_5rem_8rem_auto] sm:items-end ${
                  marcar ? "border-red-400" : "border-black/10"
                }`}
              >
                <label className="min-w-0">
                  <span className={labelClass}>
                    Concepto <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    value={c.descripcion}
                    maxLength={200}
                    disabled={disabled}
                    autoFocus={index === conceptos.length - 1 && !c.descripcion && !c.viajeId}
                    onChange={(e) => patch(index, { descripcion: e.target.value })}
                    placeholder="Ej.: Estadía"
                    className={`${inputClass} ${faltaConcepto ? "border-red-400" : ""}`}
                  />
                </label>

                <label>
                  <span className={labelClass}>
                    Cantidad <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={c.cantidadStr}
                    disabled={disabled}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => patch(index, { cantidadStr: e.target.value })}
                    className={`${inputClass} ${faltaCantidad ? "border-red-400" : ""}`}
                  />
                </label>

                <label>
                  <span className={labelClass}>
                    Monto unitario <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={c.unitarioStr}
                    disabled={disabled}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      patch(index, { unitarioStr: maskCurrencyArInput(e.target.value) })
                    }
                    className={`${inputClass} ${faltaUnitario ? "border-red-400" : ""}`}
                  />
                </label>

                <label>
                  <span className={labelClass}>
                    IVA (%) <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    inputMode="decimal"
                    value={c.ivaPctStr}
                    disabled={disabled}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => patch(index, { ivaPctStr: e.target.value })}
                    placeholder={String(ivaPctDefault)}
                    className={inputClass}
                  />
                </label>

                <div>
                  <span className={labelClass}>Subtotal c/IVA</span>
                  <div
                    className="flex h-9 items-center rounded border border-black/10 bg-vialto-mist/60 px-2 text-sm tabular-nums text-emerald-700"
                    title="Suma, con IVA"
                  >
                    + {fmtMoney(subtotalConIvaDraft(c, ivaPctDefault))}
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => quitar(index)}
                      aria-label="Quitar concepto"
                      title="Quitar concepto"
                      className="inline-flex h-9 w-9 items-center justify-center text-vialto-steel hover:bg-vialto-mist hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!disabled && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={agregar}
            disabled={llegoAlMaximo}
            title={llegoAlMaximo ? `Hasta ${FACTURA_CONCEPTOS_MAX} conceptos por factura.` : undefined}
            className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
          >
            + Agregar concepto
          </button>
        </div>
      )}
    </div>
  );
}
