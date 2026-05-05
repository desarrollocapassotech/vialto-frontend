import type { ReactNode } from 'react';
import { gananciaBrutaMetaDesdeViaje } from '@/lib/viajesGananciaBruta';
import type { Viaje } from '@/types/api';

const tooltipPanelClass =
  'pointer-events-none invisible absolute bottom-full right-0 z-20 mb-1 w-[min(22rem,calc(100vw-2.5rem))] rounded border border-black/10 bg-vialto-charcoal px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-white shadow-md opacity-0 transition-[opacity,visibility] group-hover:visible group-hover:opacity-100';

/** Encabezado de columna (sin tooltip; la ayuda está al pasar el mouse sobre cada celda). */
export function ViajeGananciaBrutaColumnHeader() {
  return <th className="px-4 py-3 text-right">Ganancia bruta</th>;
}

type Props = { viaje: Viaje; extra?: ReactNode };

/** Celda de ganancia bruta con tooltip al hover (sin subrayado). */
export function ViajeGananciaBrutaCelda({ viaje, extra }: Props) {
  const meta = gananciaBrutaMetaDesdeViaje(viaje);
  return (
    <td className="px-4 py-3 text-right tabular-nums">
      <div className="group relative flex justify-end">
        <span className="cursor-default">
          {meta.display}
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
      {extra}
    </td>
  );
}
