import { normalizeViajeMoneda } from '@/lib/currencyMask';
import type { Viaje } from '@/types/api';

export const METODO_PAGO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  otro: 'Otro',
};

export const METODOS_PAGO = ['efectivo', 'transferencia', 'cheque', 'otro'] as const;

export type SaldoTransportistaMeta = {
  moneda: 'ARS' | 'USD';
  totalAcordado: number;
  totalPagado: number;
  saldo: number;
  pagado: boolean;
};

export function viajeRequierePagosTransportista(
  v: Pick<Viaje, 'transportistaId'>,
): boolean {
  return !!String(v.transportistaId ?? '').trim();
}

/** Alineado con GET /viajes/paginated?pagoTransportista=… y saldo-pendiente-transportista. */
export type EstadoPagoTransportistaExterno = 'no_aplica' | 'sin_precio' | 'sin_pago' | 'pagado';

function totalPagadoTransportistaEnMonedaAcordada(v: Viaje): {
  moneda: 'ARS' | 'USD';
  totalAcordado: number;
  totalPagado: number;
} | null {
  if (!viajeRequierePagosTransportista(v)) return null;
  const moneda = normalizeViajeMoneda(v.monedaPrecioTransportistaExterno);
  const totalAcordado = v.precioTransportistaExterno ?? 0;
  const totalPagado = (v.pagosTransportista ?? [])
    .filter((p) => (p.moneda === 'USD' ? 'USD' : 'ARS') === moneda)
    .reduce((acc, p) => acc + p.monto, 0);
  return { moneda, totalAcordado, totalPagado };
}

/** Transportista externo con precio acordado > 0: pendiente o liquidado al 100 %. */
export function estadoPagoTransportistaExterno(v: Viaje): EstadoPagoTransportistaExterno {
  const t = totalPagadoTransportistaEnMonedaAcordada(v);
  if (!t) return 'no_aplica';
  if (t.totalAcordado <= 0) return 'sin_precio';
  if (t.totalPagado >= t.totalAcordado - 1e-6) return 'pagado';
  return 'sin_pago';
}

export function viajeCoincideFiltroPagoTransportista(
  v: Viaje,
  filtro: 'sin_pagar' | 'pagado',
): boolean {
  const estado = estadoPagoTransportistaExterno(v);
  return filtro === 'sin_pagar' ? estado === 'sin_pago' : estado === 'pagado';
}

export function calcularSaldoTransportista(v: Viaje): SaldoTransportistaMeta | null {
  const t = totalPagadoTransportistaEnMonedaAcordada(v);
  if (!t) return null;

  const saldo = t.totalAcordado - t.totalPagado;
  const pagado = t.totalAcordado > 0 && t.totalPagado >= t.totalAcordado - 1e-6;

  return {
    moneda: t.moneda,
    totalAcordado: t.totalAcordado,
    totalPagado: t.totalPagado,
    saldo,
    pagado,
  };
}
