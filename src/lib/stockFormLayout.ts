/**
 * Estilos compartidos por los wizards de Ingresos y Egresos de stock
 * (Step1/Step2/Step3 de ambos, `EgresoProductoLoteBloque`, `FotosIngresoField`).
 *
 * Mobile-first: por debajo de `sm` (640px) los controles son más grandes
 * (altura/tipografía táctil, ~44px) para ser más fáciles de tocar y leer en el
 * celular; desde `sm` en adelante vuelven al tamaño compacto de siempre.
 */

export const STOCK_FORM_INPUT =
  'h-11 w-full border border-black/15 bg-white px-3 text-base sm:h-9 sm:px-2 sm:text-sm';

export const STOCK_FORM_INPUT_READONLY =
  'h-11 w-full border border-black/10 bg-vialto-mist/30 px-3 text-base text-vialto-charcoal sm:h-9 sm:px-2 sm:text-sm';

export const STOCK_FORM_TEXTAREA =
  'w-full border border-black/15 bg-white px-3 py-2 text-base resize-none sm:px-2 sm:py-1.5 sm:text-sm';

export const STOCK_FORM_LABEL =
  'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

/** Botón de texto (Eliminar/Quitar): mismo tamaño visual, área táctil ampliada por padding negativo. */
export const STOCK_FORM_REMOVE_BTN =
  '-m-2 inline-flex items-center p-2 text-xs text-red-600 hover:underline disabled:opacity-30 disabled:no-underline';

/**
 * Barra de acciones (Volver / Guardar) pegada abajo en mobile para no obligar a
 * scrollear hasta el final en pasos largos (Step3, con varios productos). Desde
 * `sm` vuelve a ser una fila estática normal.
 */
export const STOCK_FORM_ACTIONS_STICKY =
  'sticky bottom-0 z-10 -mx-4 border-t border-black/10 bg-vialto-mist/95 px-4 py-3 backdrop-blur sm:static sm:z-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none';
