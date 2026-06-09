/** Capa del modal principal de edición (viaje, factura, etc.). */
export const MODAL_Z_EDIT = 'z-[110]';

/** Modal anidado sobre uno de edición (creación rápida desde selectores). */
export const MODAL_Z_STACKED = 'z-[120]';

/** Overlay estándar: sheet en mobile, centrado desde sm. */
export const modalOverlayClass =
  'fixed inset-0 z-50 flex items-end justify-center overflow-hidden overscroll-none bg-black/40 p-0 sm:items-center sm:p-4';

/** Panel estándar para modales de lectura / confirmación. */
export const modalPanelClass =
  'flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-xl border border-black/10 bg-white shadow-lg sm:max-h-[90vh] sm:rounded sm:max-w-xl';

/** Overlay para modales de edición grandes (viaje, factura). */
export const modalEditOverlayClass =
  'fixed inset-0 z-[110] flex items-stretch justify-center sm:items-center sm:p-4 md:p-6';

/** Panel para modales de edición grandes. */
export const modalEditPanelClass =
  'relative flex h-full max-h-[100dvh] w-full max-w-[min(72rem,calc(100vw-1rem))] flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg sm:border sm:border-black/15';

export function modalQuickCreateOverlayClass(stacked?: boolean): string {
  const z = stacked ? MODAL_Z_STACKED : 'z-50';
  return `fixed inset-0 ${z} flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4`;
}
