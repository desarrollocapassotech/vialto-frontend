import { selectorTabClass } from '@/components/ui/SelectorOpcionesSheet';
import type { ViajePagoTransportistaFiltro } from '@/lib/viajesFiltroPagoTransportista';

export type ViajesResumenFiltrosData = {
  sinFacturar: number;
  sinCobrar: number;
  sinPagar: number;
  pagados: number;
};

type FiltroId =
  | 'finalizado_sin_facturar'
  | 'facturado_sin_cobrar'
  | 'sin_pagar'
  | 'pagado';

const OPCIONES: Array<{
  id: FiltroId;
  label: string;
  countKey: keyof ViajesResumenFiltrosData;
  tipo: 'estado' | 'pago';
}> = [
  { id: 'finalizado_sin_facturar', label: 'Sin facturar', countKey: 'sinFacturar', tipo: 'estado' },
  { id: 'facturado_sin_cobrar', label: 'Sin cobrar', countKey: 'sinCobrar', tipo: 'estado' },
  { id: 'sin_pagar', label: 'Sin pagar', countKey: 'sinPagar', tipo: 'pago' },
  { id: 'pagado', label: 'Pagados', countKey: 'pagados', tipo: 'pago' },
];

function activeFilterId(
  estadoFiltro: string,
  pagoTransportistaFiltro: ViajePagoTransportistaFiltro,
): FiltroId | null {
  if (estadoFiltro === 'finalizado_sin_facturar') return 'finalizado_sin_facturar';
  if (estadoFiltro === 'facturado_sin_cobrar') return 'facturado_sin_cobrar';
  if (pagoTransportistaFiltro === 'sin_pagar') return 'sin_pagar';
  if (pagoTransportistaFiltro === 'pagado') return 'pagado';
  return null;
}

type Props = {
  resumen: ViajesResumenFiltrosData;
  estadoFiltro: string;
  pagoTransportistaFiltro: ViajePagoTransportistaFiltro;
  onFiltroEstado: (val: string) => void;
  onFiltroPago: (val: ViajePagoTransportistaFiltro) => void;
};

export function ViajesResumenFiltros({
  resumen,
  estadoFiltro,
  pagoTransportistaFiltro,
  onFiltroEstado,
  onFiltroPago,
}: Props) {
  const activeId = activeFilterId(estadoFiltro, pagoTransportistaFiltro);

  function toggleDesktop(id: FiltroId, tipo: 'estado' | 'pago') {
    if (activeId === id) {
      if (tipo === 'estado') onFiltroEstado('');
      else onFiltroPago('');
      return;
    }
    if (tipo === 'estado') onFiltroEstado(id);
    else onFiltroPago(id as ViajePagoTransportistaFiltro);
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-0.5 lg:flex-wrap lg:pb-0"
      role="tablist"
      aria-label="Filtros rápidos de viajes"
    >
      {OPCIONES.map((o) => {
        const active = activeId === o.id;
        const count = resumen[o.countKey];
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => toggleDesktop(o.id, o.tipo)}
            className={selectorTabClass(active)}
          >
            <span className="inline-flex items-center gap-2">
              {o.label}
              {count > 0 && (
                <span
                  className={[
                    'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums leading-none',
                    active ? 'bg-vialto-fire/20 text-vialto-fire' : 'bg-black/10 text-vialto-steel',
                  ].join(' ')}
                >
                  {count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
