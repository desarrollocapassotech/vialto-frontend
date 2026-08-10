import { formatViajeImporteForListado } from '@/lib/viajesFlota';
import {
  calcularSaldoTransportista,
  estadoPagoTransportistaExterno,
} from '@/lib/viajesTransportistaPagos';
import type { Viaje } from '@/types/api';

const badgeBase =
  'mt-1 inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide';
const badgeInteractive = 'cursor-pointer hover:brightness-95 text-left';

type Props = {
  viaje: Viaje;
  /** Si se pasa, el badge se vuelve clickeable y abre "Registrar pago". */
  onClick?: () => void;
};

/** Badge bajo ganancia bruta: deuda pendiente o transportista liquidado. */
export function ViajePagoTransportistaIndicador({ viaje, onClick }: Props) {
  const estado = estadoPagoTransportistaExterno(viaje);
  if (estado === 'no_aplica' || estado === 'sin_precio') return null;

  const saldo = calcularSaldoTransportista(viaje);
  if (!saldo) return null;

  const Tag = onClick ? 'button' : 'span';
  const commonProps = onClick ? { type: 'button' as const, onClick } : {};

  if (estado === 'pagado') {
    return (
      <Tag
        {...commonProps}
        className={`${badgeBase} ${onClick ? badgeInteractive : ''} border-emerald-500/80 bg-emerald-100 text-emerald-950`}
        title="El transportista externo está pagado en su totalidad"
      >
        <span aria-hidden>✓</span>
        Pagado
      </Tag>
    );
  }

  return (
    <Tag
      {...commonProps}
      className={`${badgeBase} ${onClick ? badgeInteractive : ''} border-red-400/90 bg-red-50 text-red-900`}
      title="Saldo pendiente con el transportista externo"
    >
      Sin pagar
      <span className="font-normal normal-case tracking-normal tabular-nums">
        {formatViajeImporteForListado(saldo.saldo, saldo.moneda)}
      </span>
    </Tag>
  );
}
