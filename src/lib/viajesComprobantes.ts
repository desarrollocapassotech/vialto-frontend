import { facturacionPermiteVincular, liquidacionPermiteVincular } from '@/lib/viajesIndicadores';
import type { Viaje } from '@/types/api';

/** Viaje con transportista externo: puede requerir factura al cliente y liquidación al transportista. */
export function viajeRequiereComprobanteDual(
  v: Pick<Viaje, 'transportistaId'>,
): boolean {
  return Boolean(String(v.transportistaId ?? '').trim());
}

/** Liquidación activa (no `sin_liquidar` ni `anulado`) que sigue ocupando el viaje. */
export function viajeTieneLiquidacionTransportista(
  v: Pick<Viaje, 'liquidacionEstado'>,
): boolean {
  return v.liquidacionEstado != null && !liquidacionPermiteVincular(v.liquidacionEstado);
}

export function viajePendienteComprobanteCliente(v: Pick<Viaje, 'facturacionEstado' | 'clientesViaje'>): boolean {
  if (facturacionPermiteVincular(v.facturacionEstado)) return true;
  if (v.clientesViaje) {
    for (const c of v.clientesViaje) {
      if (facturacionPermiteVincular(c.facturacionEstado)) return true;
    }
  }
  return false;
}

export function viajePendienteComprobanteTransportista(
  v: Pick<Viaje, 'liquidacionEstado'>,
): boolean {
  return v.liquidacionEstado != null && liquidacionPermiteVincular(v.liquidacionEstado);
}

/**
 * Muestra la acción «Facturar» mientras falte algún comprobante del ciclo financiero.
 * En viajes duales (cliente + transportista), el botón sigue visible si falta uno de los
 * dos — no importa el orden (factura primero o liquidación primero). Facturación y
 * liquidación son indicadores independientes: no se espera uno para completar el otro.
 */
export function viajePermiteBotonFacturar(v: Viaje): boolean {
  if (v.etapa === 'cancelado') return false;

  if (viajeRequiereComprobanteDual(v)) {
    return (
      viajePendienteComprobanteCliente(v) || viajePendienteComprobanteTransportista(v)
    );
  }

  return viajePendienteComprobanteCliente(v);
}

/** Devuelve la liquidación más relevante del viaje (la activa, o la última si todas están anuladas). */
export function liquidacionElegidaDeViaje(viaje: Pick<Viaje, 'liquidacionesViaje'>) {
  const relevantes = viaje.liquidacionesViaje ?? [];
  if (relevantes.length === 0) return undefined;
  const activa = relevantes.find((lv) => lv.liquidacion.estado !== 'anulado');
  return (activa ?? relevantes[relevantes.length - 1])?.liquidacion;
}
