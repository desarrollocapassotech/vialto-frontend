import { etiquetasDestinosDesdeViaje, textoRutaViaje } from '@/lib/viajesDestinos';
import type { Viaje } from '@/types/api';

type Props = {
  origen: string | null | undefined;
  destino?: string | null | undefined;
  destinosViaje?: Viaje['destinosViaje'];
  className?: string;
};

/** Ruta en una sola línea: «Origen → Destino 1 → Destino 2». */
export function ViajeOrigenDestinoLinea({
  origen,
  destino,
  destinosViaje,
  className,
}: Props) {
  const destinos = etiquetasDestinosDesdeViaje({ destino: destino ?? null, destinosViaje });
  const linea = textoRutaViaje(origen, destinos);
  const rawO = origen?.trim();
  const rawDestinos = destinos.map((d) => d.trim()).filter(Boolean);
  const title =
    rawO || rawDestinos.length > 0
      ? [rawO, ...rawDestinos].filter(Boolean).join(' → ')
      : undefined;

  return (
    <div
      className={`min-w-0 text-sm text-vialto-charcoal ${className ?? ''}`}
      title={title}
    >
      <span className="block min-w-0 truncate">{linea}</span>
    </div>
  );
}
