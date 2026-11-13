import { Trash2 } from "lucide-react";
import { marcarModalModificado } from "@/lib/descarteModal";

/** Máximo de caracteres por observación (mismo límite que el backend). */
export const FACTURA_OBSERVACION_MAX = 300;
/** Máximo de observaciones por factura (mismo límite que el backend). */
export const FACTURA_OBSERVACIONES_MAX = 20;

/** Observaciones listas para mandar a la API: sin espacios de más ni renglones vacíos. */
export function observacionesFacturaPayload(observaciones: string[]): string[] {
  return observaciones
    .map((o) => o.replace(/\s+/g, " ").trim())
    .filter((o) => o.length > 0);
}

/**
 * Observaciones de la factura (pedido NyM, nov 2026): como los conceptos de una liquidación,
 * pero solo texto, sin importe. Cada una sale en el PDF como un renglón debajo de los viajes.
 */
export function FacturaObservacionesEditor({
  observaciones,
  onChange,
  disabled,
  // Mismo estilo que `FacturaConceptosEditor`.
  labelClassName = "block font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.18em] text-vialto-steel",
  inputClassName = "h-9 w-full rounded border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35",
}: {
  observaciones: string[];
  onChange: (observaciones: string[]) => void;
  disabled?: boolean;
  labelClassName?: string;
  inputClassName?: string;
}) {
  const hayVacia = observaciones.some((o) => !o.trim());
  const llegoAlMaximo = observaciones.length >= FACTURA_OBSERVACIONES_MAX;

  function agregar() {
    // Agregar/quitar es solo un click (sin input/change): avisar al modal que hubo cambios.
    marcarModalModificado();
    onChange([...observaciones, ""]);
  }

  function quitar(index: number) {
    marcarModalModificado();
    onChange(observaciones.filter((_, i) => i !== index));
  }

  // Mismo armado que los conceptos (`FacturaConceptosEditor`): título, renglones y el botón
  // "+ Agregar" abajo a la izquierda.
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <p className={labelClassName}>Observaciones</p>
      {observaciones.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {observaciones.map((obs, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={obs}
                maxLength={FACTURA_OBSERVACION_MAX}
                disabled={disabled}
                autoFocus={index === observaciones.length - 1 && !obs}
                onChange={(e) =>
                  onChange(
                    observaciones.map((o, i) => (i === index ? e.target.value : o)),
                  )
                }
                placeholder="Ej.: Orden de compra 4521"
                aria-label={`Observación ${index + 1}`}
                className={inputClassName}
              />
              <button
                type="button"
                onClick={() => quitar(index)}
                disabled={disabled}
                aria-label={`Quitar observación ${index + 1}`}
                title="Quitar observación"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-vialto-steel hover:bg-vialto-mist hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={agregar}
            disabled={hayVacia || llegoAlMaximo}
            title={
              hayVacia
                ? "Completá la observación vacía antes de agregar otra."
                : llegoAlMaximo
                  ? `Hasta ${FACTURA_OBSERVACIONES_MAX} observaciones por factura.`
                  : undefined
            }
            className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
          >
            + Agregar observación
          </button>
        </div>
      )}
    </div>
  );
}
