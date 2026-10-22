import type { Viaje, ViajeAdjunto } from '@/types/api';

/**
 * Documentos vigentes del viaje. Los quitados quedan en `Viaje.adjuntos` con `borradoAt`
 * (borrado lógico, para análisis/limpieza de Cloudinary): nunca se muestran ni cuentan
 * para el tope de 3 documentos / 10 MB.
 */
export function adjuntosActivosViaje(viaje: Pick<Viaje, 'adjuntos'>): ViajeAdjunto[] {
  return (viaje.adjuntos ?? []).filter((a) => !a.borradoAt);
}
