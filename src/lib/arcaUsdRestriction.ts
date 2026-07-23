import { normalizeViajeMoneda } from '@/lib/currencyMask';
import {
  viajePendienteComprobanteCliente,
  viajePendienteComprobanteTransportista,
  viajeRequiereComprobanteDual,
} from '@/lib/viajesComprobantes';
import type { Viaje } from '@/types/api';

export const MSG_ARCA_NO_FACTURA_USD =
  'Este tenant tiene ARCA activo y no puede facturar en USD.';

export const MSG_ARCA_NO_LIQUIDA_USD =
  'Este tenant tiene ARCA activo y no puede liquidar en USD.';

export const MSG_ARCA_NO_FACTURA_NI_LIQUIDA_USD =
  'Este tenant tiene ARCA activo y no puede facturar ni liquidar en USD.';

/** Factura al cliente bloqueada por ARCA + monto en USD. */
export function arcaBloqueaFacturarUsd(
  hasArca: boolean,
  monedaMonto: string | null | undefined,
): boolean {
  return hasArca && normalizeViajeMoneda(monedaMonto) === 'USD';
}

/** Liquidación al transportista bloqueada por ARCA + precio en USD. */
export function arcaBloqueaLiquidarUsd(
  hasArca: boolean,
  monedaPrecioTransportista: string | null | undefined,
): boolean {
  return hasArca && normalizeViajeMoneda(monedaPrecioTransportista) === 'USD';
}

/**
 * Motivo para deshabilitar la acción «Facturar» cuando no queda ninguna
 * opción viable (factura y/o liquidación) por la regla ARCA + USD.
 * Si hay al menos una opción usable, retorna null (abrir selector).
 */
export function motivoBloqueoAccionFacturarArcaUsd(
  hasArca: boolean,
  v: Viaje,
): string | null {
  if (!hasArca) return null;

  const pendienteCliente = viajePendienteComprobanteCliente(v);
  const pendienteTransportista = viajePendienteComprobanteTransportista(v);
  const bloqueaCliente =
    pendienteCliente && arcaBloqueaFacturarUsd(hasArca, v.monedaMonto);
  const bloqueaLiq =
    pendienteTransportista &&
    arcaBloqueaLiquidarUsd(hasArca, v.monedaPrecioTransportistaExterno);

  if (viajeRequiereComprobanteDual(v)) {
    if (pendienteCliente && pendienteTransportista) {
      if (bloqueaCliente && bloqueaLiq) return MSG_ARCA_NO_FACTURA_NI_LIQUIDA_USD;
      return null;
    }
    if (pendienteCliente && bloqueaCliente) return MSG_ARCA_NO_FACTURA_USD;
    if (pendienteTransportista && bloqueaLiq) return MSG_ARCA_NO_LIQUIDA_USD;
    return null;
  }

  if (bloqueaCliente) return MSG_ARCA_NO_FACTURA_USD;
  return null;
}
