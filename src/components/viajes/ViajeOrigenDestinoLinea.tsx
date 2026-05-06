import { soloCiudadDesdeEtiquetaUbicacion } from '@/lib/ciudades';

type Props = {
  origen: string | null | undefined;
  destino: string | null | undefined;
  className?: string;
};

/** Muestra siempre origen arriba y destino abajo con flecha. */
export function ViajeOrigenDestinoLinea({ origen, destino, className }: Props) {
  const o = soloCiudadDesdeEtiquetaUbicacion(origen);
  const d = soloCiudadDesdeEtiquetaUbicacion(destino);
  const origenTexto = o || '—';
  const destinoTexto = d || '—';
  const rawO = origen?.trim();
  const rawD = destino?.trim();
  const title =
    rawO && rawD ? `${rawO} → ${rawD}` : rawO || rawD || undefined;

  return (
    <div
      className={`min-w-0 text-sm text-vialto-charcoal ${className ?? ''}`}
      title={title}
    >
      <div className="grid min-w-0 grid-cols-1 gap-0.5">
        <span className="min-w-0 truncate">{origenTexto}</span>
        <span className="min-w-0 truncate text-vialto-steel">
          <span className="mr-1.5 select-none text-vialto-steel/80" aria-hidden>
            ↓
          </span>
          {destinoTexto}
        </span>
      </div>
    </div>
  );
}
