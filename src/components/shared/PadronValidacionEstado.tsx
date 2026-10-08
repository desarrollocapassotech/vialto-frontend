import { AlertTriangle, BadgeCheck, CircleSlash, RotateCw, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import type { PadronValidacionResultado } from "@/hooks/useValidacionPadronRegistro";

function fmtFechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Estado de la validación contra el padrón de ARCA de un cliente/transportista ya guardado
 * (`useValidacionPadronRegistro`), para mostrar debajo de su nombre en el resumen.
 * No muestra nada si la validación no aplica o no está habilitada.
 */
export function PadronValidacionEstado({
  habilitado,
  pendiente,
  resultado,
  consultado,
  onRevisar,
  onReintentar,
}: {
  habilitado: boolean;
  pendiente: boolean;
  resultado: PadronValidacionResultado | null;
  /** true = ya hubo respuesta para este registro (con `resultado` null = falló la consulta). */
  consultado: boolean;
  /** Abre el modal para revisar/corregir los datos. */
  onRevisar?: () => void;
  /** Vuelve a consultar cuando ARCA falló. */
  onReintentar?: () => void;
}) {
  if (!habilitado) return null;
  const base = "inline-flex items-center gap-1 text-[11px] font-medium";

  if (pendiente) {
    return (
      <span className={`${base} text-vialto-steel`} role="status">
        <Spinner className="h-3 w-3" /> Validando con ARCA…
      </span>
    );
  }
  if (!resultado) {
    return consultado ? (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span
          className={`${base} text-vialto-steel`}
          title="ARCA no respondió o se alcanzó el límite diario de consultas. No bloquea la emisión."
        >
          <CircleSlash className="h-3.5 w-3.5" aria-hidden /> No se pudo validar con ARCA
        </span>
        {onReintentar && (
          <button
            type="button"
            onClick={onReintentar}
            title="Reintentar"
            aria-label="Reintentar validación con ARCA"
            className="inline-flex h-5 w-5 items-center justify-center rounded text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </span>
    ) : null;
  }

  switch (resultado.resultado) {
    case "no_aplica":
      return null;
    case "validado":
      return (
        <span
          className={`${base} text-emerald-700`}
          title={`CUIT, condición IVA y domicilio validados contra el padrón de ARCA el ${fmtFechaHora(resultado.validadoAt)}.`}
        >
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Validado en ARCA
        </span>
      );
    case "diferencias":
      return (
        <button
          type="button"
          onClick={onRevisar}
          className={`${base} text-amber-700 underline decoration-dotted underline-offset-2 hover:text-amber-900`}
          title="ARCA informa otra condición IVA o domicilio. Click para revisar."
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Revisar datos (ARCA)
        </button>
      );
    case "rechazado":
      return (
        <button
          type="button"
          onClick={onRevisar}
          className={`${base} text-red-700 underline decoration-dotted underline-offset-2 hover:text-red-900`}
          title="Click para revisar el CUIT."
        >
          <XCircle className="h-3.5 w-3.5" aria-hidden />
          {resultado.padron.estado === "inactivo"
            ? "CUIT inactivo en ARCA"
            : "CUIT no figura en ARCA"}
        </button>
      );
  }
}
