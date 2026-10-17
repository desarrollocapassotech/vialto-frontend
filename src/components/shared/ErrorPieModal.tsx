import { useEffect } from "react";
import { AvisoFaltantesEmision } from "@/components/shared/AvisoFaltantesEmision";
import { useZumbidoAviso } from "@/hooks/useZumbidoAviso";
import { isAfipInfrastructureError, MSG_AFIP_INFRA } from "@/lib/arcaFriendlyError";

/**
 * Errores de un modal (validación por campo + error de API/ARCA) en un aviso rojo en el
 * pie, a la izquierda de los botones, que zumba cada vez que aparece o cambia (ej. al volver
 * a tocar "Guardar" con el mismo campo vacío: `setFieldErrors` crea un objeto nuevo).
 *
 * Regla del sistema (ver CLAUDE.md, "Errores en modales"): el campo con error sigue con
 * borde rojo, pero el texto va solo acá — no debajo del input ni en una alerta del cuerpo.
 * Con varios errores muestra el primero + "(y N errores más)".
 *
 * El pie que lo contiene tiene que ser `flex flex-wrap items-center` (el aviso ocupa el
 * espacio libre a la izquierda y en mobile baja a su propia fila).
 */
export function ErrorPieModal({
  error,
  fieldErrors,
}: {
  error?: string | null;
  fieldErrors?: Record<string, string | null | undefined> | null;
}) {
  const { zumbando, disparar, terminar } = useZumbidoAviso();
  const mensajes = [
    ...Object.values(fieldErrors ?? {}).filter((m): m is string => Boolean(m?.trim())),
    ...(error?.trim()
      ? [isAfipInfrastructureError(error) ? MSG_AFIP_INFRA : error]
      : []),
  ];
  const hay = mensajes.length > 0;

  useEffect(() => {
    if (hay) disparar();
    // Zumba en cada error nuevo (cambia la referencia de `fieldErrors` o el texto de `error`).
  }, [fieldErrors, error, hay, disparar]);

  if (!hay) return null;
  const resto = mensajes.length - 1;
  const mensaje =
    resto > 0
      ? `${mensajes[0]} (y ${resto} error${resto === 1 ? "" : "es"} más)`
      : mensajes[0];

  return (
    <AvisoFaltantesEmision
      mensaje={mensaje}
      hayOcultos={false}
      bloqueante
      zumbando={zumbando}
      onZumbidoEnd={terminar}
    />
  );
}
