/** True si el viaje usa transportista externo (no chofer/vehículo propios). */
export function isViajeOperacionExterna(transportistaId: string): boolean {
  return transportistaId.trim() !== '';
}
