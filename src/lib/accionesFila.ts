import type { AccionOpcion } from '@/components/ui/AccionesOpcionesSheet';

/**
 * Click en la fila (regla global de grillas): con una sola acción la ejecuta directo;
 * con varias abre el modal de acciones (`abrir`).
 */
export function clickFilaAcciones(options: AccionOpcion[], abrir: () => void) {
  if (options.length === 1) {
    if (!options[0].disabled) options[0].onClick();
  } else if (options.length > 1) {
    abrir();
  }
}
