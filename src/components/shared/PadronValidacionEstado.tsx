import { BadgeCheck, CircleSlash, RotateCw, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import type { PadronActualizado, PadronValidacionResultado } from "@/hooks/useValidacionPadronRegistro";

const CAMBIO_LABEL: Record<PadronActualizado["cambios"][number], string> = {
  nombre: "la razón social",
  condicionIva: "la condición IVA",
  domicilio: "el domicilio",
};

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
  /** Abre el modal para revisar/editar los datos (CUIT rechazado, o datos actualizados desde ARCA). */
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
    case "actualizado":
      // Mismo tilde verde que "validado"; el detalle de qué se actualizó va en el tooltip.
      return (
        <span
          className={`${base} flex-wrap text-emerald-700`}
          role="status"
          title={`Se actualizó ${resultado.cambios.map((c) => CAMBIO_LABEL[c]).join(", ")} automáticamente con los datos del padrón de ARCA el ${fmtFechaHora(resultado.validadoAt)}.`}
        >
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Validado con ARCA
          {onRevisar && (
            <>
              <span aria-hidden className="text-vialto-steel">·</span>
              <button
                type="button"
                onClick={onRevisar}
                className="font-normal text-vialto-steel underline decoration-dotted underline-offset-2 hover:text-vialto-charcoal"
              >
                Ver datos
              </button>
            </>
          )}
        </span>
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
