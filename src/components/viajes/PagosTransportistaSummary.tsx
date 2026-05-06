import { formatViajeImporteForListado } from '@/lib/viajesFlota';
import { calcularSaldoTransportista } from '@/lib/viajesTransportistaPagos';
import type { Viaje } from '@/types/api';

interface Props {
  viaje: Viaje;
  onRegistrarPago: () => void;
}

const labelClass =
  'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

export function PagosTransportistaSummary({ viaje, onRegistrarPago }: Props) {
  const saldo = calcularSaldoTransportista(viaje);
  if (!saldo) return null;

  const pagos = viaje.pagosTransportista ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={labelClass}>Pagos al transportista</span>
        <button
          type="button"
          onClick={onRegistrarPago}
          className="text-xs border border-black/20 bg-white px-2 py-1 hover:bg-gray-50 active:bg-gray-100"
        >
          + Registrar pago
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded border border-black/10 bg-white px-3 py-2.5 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className={labelClass}>Total acordado</span>
          <span className="tabular-nums">
            {saldo.totalAcordado > 0
              ? formatViajeImporteForListado(saldo.totalAcordado, saldo.moneda)
              : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={labelClass}>Total pagado</span>
          <span className="tabular-nums">
            {saldo.totalPagado > 0
              ? formatViajeImporteForListado(saldo.totalPagado, saldo.moneda)
              : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={labelClass}>Saldo pendiente</span>
          <span
            className={`font-semibold tabular-nums ${
              saldo.pagado ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {saldo.pagado
              ? '✓ Pagado'
              : formatViajeImporteForListado(saldo.saldo, saldo.moneda)}
          </span>
        </div>
      </div>

      {pagos.length > 0 ? (
        <div className="flex flex-col divide-y divide-black/5 rounded border border-black/10 bg-white">
          {pagos.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 text-xs text-vialto-charcoal"
            >
              <span className="font-medium tabular-nums">
                {formatViajeImporteForListado(p.monto, p.moneda)}
              </span>
              <span className="text-vialto-steel">
                {p.fecha
                  ? new Date(p.fecha).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : '—'}
              </span>
              {p.observaciones && (
                <span className="text-vialto-steel/70">{p.observaciones}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-vialto-steel">Sin pagos registrados.</p>
      )}
    </div>
  );
}

