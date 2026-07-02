import { viajeTieneFacturaAsignada } from '@/lib/viajesFlota';
import type { Viaje } from '@/types/api';

/** Viaje con transportista externo: requiere factura al cliente y liquidación al transportista. */
export function viajeRequiereComprobanteDual(
  v: Pick<Viaje, 'transportistaId'>,
): boolean {
  return Boolean(String(v.transportistaId ?? '').trim());
}

export function viajeTieneLiquidacionTransportista(v: {
  liquidacionesViaje?: { liquidacionId: string }[] | null;
}): boolean {
  return (v.liquidacionesViaje?.length ?? 0) > 0;
}

export function viajePendienteComprobanteCliente(v: Viaje): boolean {
  return !viajeTieneFacturaAsignada(v);
}

export function viajePendienteComprobanteTransportista(v: Viaje): boolean {
  if (!viajeRequiereComprobanteDual(v)) return false;
  return !viajeTieneLiquidacionTransportista(v);
}

/**
 * Muestra la acción «Facturar» mientras falte algún comprobante del ciclo financiero.
 * En viajes duales, no se oculta al emitir solo la factura al cliente.
 */
export function viajePermiteBotonFacturar(v: Viaje): boolean {
  const e = String(v.estado).trim().toLowerCase();
  if (e === 'cancelado' || e === 'cobrado' || e === 'finalizado_cobrado') return false;

  if (viajeRequiereComprobanteDual(v)) {
    return (
      viajePendienteComprobanteCliente(v) || viajePendienteComprobanteTransportista(v)
    );
  }

  if (e === 'finalizado_facturado' || e === 'facturado_sin_cobrar') return false;
  return true;
}
