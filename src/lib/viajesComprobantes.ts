import { viajeTieneFacturaAsignada } from '@/lib/viajesFlota';
import type { Viaje } from '@/types/api';

/** Viaje con transportista externo: requiere factura al cliente y liquidación al transportista. */
export function viajeRequiereComprobanteDual(
  v: Pick<Viaje, 'transportistaId'>,
): boolean {
  return Boolean(String(v.transportistaId ?? '').trim());
}

/** Liquidación que sigue ocupando el viaje (anuladas no cuentan). */
function liquidacionActivaEnViaje(lv: {
  liquidacionId: string;
  liquidacion?: { estado?: string } | null;
}): boolean {
  const estado = String(lv.liquidacion?.estado ?? "").trim().toLowerCase();
  // Sin include de liquidación, asumimos activa (evita liberar de más).
  if (!estado) return true;
  return estado !== "anulado";
}

export function viajeTieneLiquidacionTransportista(v: {
  liquidacionesViaje?: {
    liquidacionId: string;
    liquidacion?: { estado?: string } | null;
  }[] | null;
}): boolean {
  return (v.liquidacionesViaje ?? []).some(liquidacionActivaEnViaje);
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
 * En viajes duales (cliente + transportista), el botón sigue visible si falta uno de los
 * dos — no importa el orden (factura primero o liquidación primero).
 */
export function viajePermiteBotonFacturar(v: Viaje): boolean {
  const e = String(v.estado).trim().toLowerCase();
  if (e === 'cancelado' || e === 'cobrado' || e === 'finalizado_cobrado') return false;

  if (viajeRequiereComprobanteDual(v)) {
    return (
      viajePendienteComprobanteCliente(v) || viajePendienteComprobanteTransportista(v)
    );
  }

  // Sin transportista externo: solo factura al cliente.
  if (viajeTieneFacturaAsignada(v)) return false;
  if (e === 'finalizado_facturado' || e === 'facturado_sin_cobrar') return false;
  return true;
}
