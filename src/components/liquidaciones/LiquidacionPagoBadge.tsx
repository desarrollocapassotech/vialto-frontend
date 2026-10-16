import type { EstadoPagoLiquidacion } from '@/types/api';

const LABEL: Record<'pagada' | 'pago_parcial', string> = {
  pagada: 'PAGADA',
  pago_parcial: 'PAGO PARCIAL',
};

/** Mismos colores que COBRADO de Facturas (pagada) y un ámbar para el pago parcial. */
const CLASS: Record<'pagada' | 'pago_parcial', string> = {
  pagada: 'bg-emerald-200 text-emerald-950',
  pago_parcial: 'bg-amber-100 text-amber-900',
};

/**
 * Badge de pago de una liquidación, ADITIVO al de estado (nunca lo reemplaza). Sale solo
 * de Cuenta corriente: se actualiza al registrar/imputar pagos allá, Liquidaciones no lo
 * cambia. Pendiente o anulada: no muestra nada.
 */
export function LiquidacionPagoBadge({ estadoPago }: { estadoPago?: EstadoPagoLiquidacion }) {
  if (estadoPago !== 'pagada' && estadoPago !== 'pago_parcial') return null;
  return (
    <span
      title="Según los pagos registrados en Cuenta corriente"
      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs ${CLASS[estadoPago]}`}
    >
      {LABEL[estadoPago]}
    </span>
  );
}
