/**
 * Clases compartidas con listados de productos, viajes y facturación (tabla + envoltorio).
 */
export const pageTitleClass =
  'font-[family-name:var(--font-display)] text-3xl sm:text-4xl tracking-wide';

export const listadoDatosWrapperClass =
  'rounded border border-black/5 bg-white';

export const listadoCardListClass = 'flex flex-col gap-3 p-3 lg:hidden';

export const listadoCardClass =
  'rounded-lg border border-black/8 bg-vialto-mist/40 p-4';

export const listadoCardPrimaryClass =
  'mb-3 border-b border-black/10 pb-3 font-medium text-base text-vialto-charcoal';

export const listadoCardFieldLabelClass =
  'font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.14em] text-vialto-steel';

export const listadoCardFieldValueClass = 'min-w-0 break-words text-sm text-vialto-charcoal';

export const listadoCardActionsClass =
  'mt-4 flex flex-wrap justify-end gap-2 border-t border-black/10 pt-3';

export const listadoTablaWrapperClass =
  'overflow-x-auto rounded border border-black/5 bg-white [-webkit-overflow-scrolling:touch]';

export const listadoTablaClass = 'w-full border-collapse text-left text-base';

export const listadoTablaTheadClass = '[&_th]:border-b [&_th]:border-black/10';

export const listadoTablaTbodyClass = '[&_td]:border-b [&_td]:border-black/5';

export const listadoTablaHeadRowClass =
  'bg-vialto-mist font-[family-name:var(--font-ui)] text-[13px] uppercase tracking-[0.15em] text-vialto-fire md:text-[15px] md:tracking-[0.2em]';

export const listadoTablaBodyRowClass = 'hover:bg-vialto-mist';

export const listadoTablaThClass = 'px-3 py-3 md:px-4';

export const listadoTablaTdClass = 'px-3 py-3 text-vialto-charcoal md:px-4';

export const listadoTablaEmptyCellClass = 'px-4 py-8 text-vialto-steel';

/** Oculta columna en mobile (<768px). */
export const listadoColHideMobile = 'hidden md:table-cell';

/** Oculta columna en mobile y tablet (<1024px). */
export const listadoColHideUntilLg = 'hidden lg:table-cell';

/** Botón de acción en celdas (Ver, Editar, etc.), alineado con clientes, productos y depósitos. */
export const listadoTablaAccionClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center text-xs uppercase tracking-wider px-3 py-2 border border-black/20 hover:bg-vialto-mist md:min-h-0 md:min-w-0 md:px-2 md:py-1';

/** @deprecated Usar listadoTablaAccionClass para acciones en tablas. */
export const listadoTablaLinkClass =
  'text-xs uppercase tracking-wider text-vialto-fire hover:underline font-[family-name:var(--font-ui)]';
