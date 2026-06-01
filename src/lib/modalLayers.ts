/** Capa del modal principal de edición (viaje, factura, etc.). */
export const MODAL_Z_EDIT = 'z-[110]';

/** Modal anidado sobre uno de edición (creación rápida desde selectores). */
export const MODAL_Z_STACKED = 'z-[120]';

export function modalQuickCreateOverlayClass(stacked?: boolean): string {
  const z = stacked ? MODAL_Z_STACKED : 'z-50';
  return `fixed inset-0 ${z} flex items-center justify-center bg-black/50 p-4`;
}
