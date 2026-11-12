import { X } from "lucide-react";
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
  labelClassName = "text-xs uppercase tracking-wider text-vialto-steel",
  inputClassName = "h-8 w-full border border-black/15 bg-white px-2 text-sm",
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

  return (
    <div className="flex shrink-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className={labelClassName}>Observaciones</p>
        <button
          type="button"
          onClick={agregar}
          disabled={disabled || hayVacia || llegoAlMaximo}
          title={
            hayVacia
              ? "Completá la observación vacía antes de agregar otra."
              : llegoAlMaximo
                ? `Hasta ${FACTURA_OBSERVACIONES_MAX} observaciones por factura.`
                : undefined
          }
          className="px-2 py-1 text-xs uppercase tracking-wider border border-black/20 hover:bg-vialto-mist disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Agregar observación
        </button>
      </div>
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
                className="flex h-8 w-8 shrink-0 items-center justify-center text-vialto-steel hover:text-red-600 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-vialto-steel">
        Sale en el PDF debajo de los viajes, sin importe.
      </p>
    </div>
  );
}
