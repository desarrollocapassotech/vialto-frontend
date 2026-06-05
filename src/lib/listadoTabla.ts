/**
 * Clases compartidas con listados de productos, viajes y facturación (tabla + envoltorio).
 */
export const listadoTablaWrapperClass = 'overflow-x-auto rounded border border-black/5 bg-white shadow-sm';

export const listadoTablaClass = 'w-full text-left text-base';

export const listadoTablaHeadRowClass =
  'border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire';

export const listadoTablaBodyRowClass = 'border-b border-black/5 hover:bg-vialto-mist/80';

export const listadoTablaThClass = 'px-4 py-3';

export const listadoTablaTdClass = 'px-4 py-3 text-vialto-charcoal';

export const listadoTablaEmptyCellClass = 'px-4 py-8 text-vialto-steel';

/** Botón de acción en celdas (Ver, Editar, etc.), alineado con clientes, productos y depósitos. */
export const listadoTablaAccionClass =
  'text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist';

/** @deprecated Usar listadoTablaAccionClass para acciones en tablas. */
export const listadoTablaLinkClass =
  'text-xs uppercase tracking-wider text-vialto-fire hover:underline font-[family-name:var(--font-ui)]';
