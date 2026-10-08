import { Fragment } from 'react';
import { soloCiudadDesdeEtiquetaUbicacion } from '@/lib/ciudades';
import { etiquetasDestinosDesdeViaje } from '@/lib/viajesDestinos';
import type { Viaje } from '@/types/api';

type Props = {
  origen: string | null | undefined;
  destino?: string | null | undefined;
  destinosViaje?: Viaje['destinosViaje'];
  className?: string;
  /** Una sola línea (grilla desktop): primera y última parada, recortadas; las intermedias como "+N". */
  compacto?: boolean;
};

function partesRutaVisibles(
  origen: string | null | undefined,
  destinos: string[],
): string[] {
  const partes: string[] = [];
  const o = origen?.trim();
  if (o) partes.push(soloCiudadDesdeEtiquetaUbicacion(o) || o);
  for (const d of destinos) {
    const t = d.trim();
    if (t) partes.push(soloCiudadDesdeEtiquetaUbicacion(t) || t);
  }
  return partes.length > 0 ? partes : ['—'];
}

/** Ruta legible: origen y destinos con flechas; hace wrap entre paradas sin cortar nombres. */
export function ViajeOrigenDestinoLinea({
  origen,
  destino,
  destinosViaje,
  className,
  compacto,
}: Props) {
  const destinos = etiquetasDestinosDesdeViaje({ destino: destino ?? null, destinosViaje });
  const partes = partesRutaVisibles(origen, destinos);
  const rawO = origen?.trim();
  const rawDestinos = destinos.map((d) => d.trim()).filter(Boolean);
  const title =
    rawO || rawDestinos.length > 0
      ? [rawO, ...rawDestinos].filter(Boolean).join(' → ')
      : undefined;

  if (compacto) {
    const primera = partes[0];
    const ultima = partes.length > 1 ? partes[partes.length - 1] : null;
    const intermedias = Math.max(partes.length - 2, 0);
    return (
      <div
        className={`flex min-w-0 items-baseline gap-1 text-vialto-charcoal ${className ?? ''}`}
        title={title}
      >
        <span className="truncate">{primera}</span>
        {ultima && (
          <>
            <span className="shrink-0 text-vialto-steel/75 select-none" aria-hidden>
              →
            </span>
            <span className="truncate">{ultima}</span>
            {intermedias > 0 && (
              <span className="shrink-0 text-[11px] text-vialto-fire">+{intermedias}</span>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`min-w-0 text-sm text-vialto-charcoal ${className ?? ''}`}
      title={title}
    >
      <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 leading-snug">
        {partes.map((parte, i) => (
          <Fragment key={`${i}-${parte}`}>
            {i > 0 && (
              <span className="shrink-0 text-vialto-steel/75 select-none" aria-hidden>
                →
              </span>
            )}
            <span className="min-w-0">{parte}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
