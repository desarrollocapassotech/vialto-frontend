import type { ReactNode } from 'react';
import { ViajePagoTransportistaIndicador } from '@/components/viajes/ViajePagoTransportistaIndicador';
import {
  gananciaBrutaDesgloseDetalle,
  gananciaBrutaMetaDesdeViaje,
} from '@/lib/viajesGananciaBruta';
import { formatViajeImporteForListado } from '@/lib/viajesFlota';
import type { Viaje } from '@/types/api';

import { listadoColHideUntilLg } from '@/lib/listadoTabla';
import { tooltipPanelClass } from '@/lib/tooltip';

/** Encabezado de columna (sin tooltip; la ayuda está al pasar el mouse sobre cada celda). */
export function ViajeGananciaBrutaColumnHeader() {
  return <th className={`px-4 py-3 text-right ${listadoColHideUntilLg}`}>Ganancia bruta</th>;
}

type Props = { viaje: Viaje; extra?: ReactNode };

/** Celda de ganancia bruta con tooltip al hover (sin subrayado). */
export function ViajeGananciaBrutaCelda({ viaje, extra }: Props) {
  const meta = gananciaBrutaMetaDesdeViaje(viaje);
  const indicadorPago = extra ?? <ViajePagoTransportistaIndicador viaje={viaje} />;
  return (
    <td className={`px-4 py-3 text-right tabular-nums ${listadoColHideUntilLg}`}>
      <div className="group relative flex flex-col items-end gap-0.5">
        <div className="relative">
          <span className="cursor-default">
            {meta.lineasBalance && meta.lineasBalance.length > 1 ? (
              <span className="flex flex-col items-end gap-0.5 leading-tight">
                {meta.lineasBalance.map((l) => (
                  <span key={l.moneda} className="tabular-nums">
                    {l.formatted}
                  </span>
                ))}
              </span>
            ) : (
              meta.display
            )}
            {meta.reason && (
              <span className="block text-[10px] text-vialto-steel/70 tabular-nums">{meta.reason}</span>
            )}
          </span>
          <div className={tooltipPanelClass} role="tooltip">
            {meta.tooltipParagraphs.map((p, i) => (
              <p key={i} className={i === 0 ? 'font-medium text-white' : 'mt-1.5 leading-snug'}>
                {p}
              </p>
            ))}
          </div>
        </div>
        {indicadorPago}
      </div>
    </td>
  );
}

/** Bloque de detalle (modal "Ver"): monto + desglose en filas, sin depender del hover. */
export function ViajeGananciaBrutaDetalle({ viaje }: { viaje: Viaje }) {
  const meta = gananciaBrutaMetaDesdeViaje(viaje);
  const filas = gananciaBrutaDesgloseDetalle(viaje);
  return (
    <div className="sm:col-span-2">
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Ganancia bruta</p>
      {meta.lineasBalance && meta.lineasBalance.length > 1 ? (
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-lg font-medium tabular-nums text-vialto-charcoal">
          {meta.lineasBalance.map((l) => (
            <span key={l.moneda}>{l.formatted}</span>
          ))}
        </p>
      ) : (
        <p className="mt-1 text-lg font-medium tabular-nums text-vialto-charcoal">{meta.display}</p>
      )}
      {meta.reason && <p className="text-xs text-vialto-steel">{meta.reason}</p>}

      {filas.length > 0 && (
        <dl className="mt-2 divide-y divide-black/5 border-t border-black/5">
          {filas.map((f, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
              <dt className="text-vialto-steel">
                {f.label}
                {f.tag && <span className="ml-1.5 text-[11px] text-vialto-steel/60">{f.tag}</span>}
              </dt>
              <dd
                className={`shrink-0 tabular-nums font-medium ${
                  f.monto < 0 ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {f.monto < 0 ? '−' : '+'}
                {formatViajeImporteForListado(Math.abs(f.monto), f.moneda)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-2">
        <ViajePagoTransportistaIndicador viaje={viaje} />
      </div>
    </div>
  );
}
