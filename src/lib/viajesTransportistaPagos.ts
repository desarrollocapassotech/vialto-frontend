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

export function calcularSaldoTransportista(v: Viaje): SaldoTransportistaMeta | null {
  if (!viajeRequierePagosTransportista(v)) return null;

  const moneda = normalizeViajeMoneda(v.monedaPrecioTransportistaExterno);
  const totalAcordado = v.precioTransportistaExterno ?? 0;
  const pagos = v.pagosTransportista ?? [];
  const totalPagado = pagos
    .filter((p) => (p.moneda === 'USD' ? 'USD' : 'ARS') === moneda)
    .reduce((acc, p) => acc + p.monto, 0);
  const saldo = totalAcordado - totalPagado;

  return { moneda, totalAcordado, totalPagado, saldo, pagado: saldo <= 0 };
}
