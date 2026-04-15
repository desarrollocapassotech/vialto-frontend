import { soloCiudadDesdeEtiquetaUbicacion } from '@/lib/ciudades';

type Props = {
  origen: string | null | undefined;
  destino: string | null | undefined;
  className?: string;
};

/** Origen y destino en una sola línea: ciudad → ciudad. */
export function ViajeOrigenDestinoLinea({ origen, destino, className }: Props) {
  const o = soloCiudadDesdeEtiquetaUbicacion(origen);
  const d = soloCiudadDesdeEtiquetaUbicacion(destino);
  const rawO = origen?.trim();
  const rawD = destino?.trim();
  const title =
    rawO && rawD ? `${rawO} → ${rawD}` : rawO || rawD || undefined;

  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 text-sm text-vialto-charcoal ${className ?? ''}`}
      title={title}
    >
      <span className="min-w-0 truncate">{o || '—'}</span>
      <span className="shrink-0 select-none text-vialto-steel/80" aria-hidden>
        →
      </span>
      <span className="min-w-0 truncate">{d || '—'}</span>
    </div>
  );
}
