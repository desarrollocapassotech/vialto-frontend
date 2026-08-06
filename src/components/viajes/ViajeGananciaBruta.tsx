import type { ReactNode } from 'react';
import { ViajePagoTransportistaIndicador } from '@/components/viajes/ViajePagoTransportistaIndicador';
import { gananciaBrutaMetaDesdeViaje } from '@/lib/viajesGananciaBruta';
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
