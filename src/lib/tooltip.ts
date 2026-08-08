/**
 * Panel de tooltip a mostrar al hacer hover sobre un contenedor `group relative`.
 * El disparador (botón, celda, etc.) debe estar envuelto en un elemento con
 * clases `group relative` para que `group-hover:visible` funcione.
 */
export const tooltipPanelClass =
  'pointer-events-none invisible absolute bottom-full right-0 z-20 mb-1 w-[min(22rem,calc(100vw-2.5rem))] rounded border border-black/10 bg-vialto-charcoal px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-white shadow-md opacity-0 transition-[opacity,visibility] group-hover:visible group-hover:opacity-100';

/**
 * Variante que abre hacia abajo y hacia la derecha en lugar de hacia arriba y la izquierda.
 * Usar en disparadores pegados al borde superior izquierdo de un contenedor con scroll
 * (p. ej. la primera columna del encabezado de una tabla), donde `tooltipPanelClass`
 * queda recortado por el `overflow-x-auto` del wrapper o se sale por la izquierda.
 */
export const tooltipPanelClassBelow =
  'pointer-events-none invisible absolute top-full left-0 z-20 mt-1 w-[min(22rem,calc(100vw-2.5rem))] rounded border border-black/10 bg-vialto-charcoal px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-white shadow-md opacity-0 transition-[opacity,visibility] group-hover:visible group-hover:opacity-100';
