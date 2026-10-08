import { HandCoins } from 'lucide-react';
import { EstadoIcono } from '@/components/viajes/EstadoIcono';
import { formatViajeImporteForListado } from '@/lib/viajesFlota';
import {
  calcularSaldoTransportista,
  estadoPagoTransportistaExterno,
} from '@/lib/viajesTransportistaPagos';
import { useFieldConfig } from '@/hooks/useFieldConfig';
import type { Viaje } from '@/types/api';

const badgeBase =
  'mt-1 inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide';
const badgeInteractive = 'cursor-pointer hover:brightness-95 text-left';

type Props = {
  viaje: Viaje;
  /** Si se pasa, el badge se vuelve clickeable y abre "Registrar pago". */
  onClick?: () => void;
  /** `icono`: ícono compacto de una sola línea (columna "Liquidación" de la grilla). */
  variante?: 'badge' | 'icono';
};

/** Badge bajo ganancia bruta: deuda pendiente o transportista liquidado. */
export function ViajePagoTransportistaIndicador({ viaje, onClick, variante = 'badge' }: Props) {
  const { isVisible } = useFieldConfig('viajes');
  if (!isVisible('detalle_viaje', 'pagosTransportista')) return null;

  const estado = estadoPagoTransportistaExterno(viaje);
  if (estado === 'no_aplica' || estado === 'sin_precio') return null;

  const saldo = calcularSaldoTransportista(viaje);
  if (!saldo) return null;

  if (variante === 'icono') {
    const pagado = estado === 'pagado';
    return (
      <EstadoIcono
        icon={HandCoins}
        glifo={pagado ? 'ok' : 'error'}
        colorClass={
          pagado
            ? 'border-emerald-500/80 bg-emerald-100 text-emerald-950'
            : 'border-red-400/90 bg-red-50 text-red-900'
        }
        title={
          pagado
            ? 'Transportista pagado en su totalidad'
            : `Saldo pendiente con el transportista: ${formatViajeImporteForListado(saldo.saldo, saldo.moneda)}`
        }
        onClick={onClick}
      />
    );
  }

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
