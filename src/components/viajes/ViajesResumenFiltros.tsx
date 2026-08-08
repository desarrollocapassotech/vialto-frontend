import { selectorTabClass } from '@/components/ui/SelectorOpcionesSheet';
import type { ViajePagoTransportistaFiltro } from '@/lib/viajesFiltroPagoTransportista';

export type ViajesResumenFiltrosData = {
  sinFacturar: number;
  sinCobrar: number;
  sinPagar: number;
  pagados: number;
};

type FiltroId = 'sin_facturar' | 'facturado' | 'sin_pagar' | 'pagado';

const OPCIONES: Array<{
  id: FiltroId;
  label: string;
  countKey: keyof ViajesResumenFiltrosData;
  tipo: 'facturacion' | 'pago';
}> = [
  { id: 'sin_facturar', label: 'Sin facturar', countKey: 'sinFacturar', tipo: 'facturacion' },
  { id: 'facturado', label: 'Sin cobrar', countKey: 'sinCobrar', tipo: 'facturacion' },
  { id: 'sin_pagar', label: 'Sin pagar', countKey: 'sinPagar', tipo: 'pago' },
  { id: 'pagado', label: 'Pagados', countKey: 'pagados', tipo: 'pago' },
];

function activeFilterId(
  facturacionFiltro: string,
  pagoTransportistaFiltro: ViajePagoTransportistaFiltro,
): FiltroId | null {
  if (facturacionFiltro === 'sin_facturar') return 'sin_facturar';
  if (facturacionFiltro === 'facturado') return 'facturado';
  if (pagoTransportistaFiltro === 'sin_pagar') return 'sin_pagar';
  if (pagoTransportistaFiltro === 'pagado') return 'pagado';
  return null;
}

type Props = {
  resumen: ViajesResumenFiltrosData;
  facturacionFiltro: string;
  pagoTransportistaFiltro: ViajePagoTransportistaFiltro;
  onFiltroFacturacion: (val: string) => void;
  onFiltroPago: (val: ViajePagoTransportistaFiltro) => void;
};

export function ViajesResumenFiltros({
  resumen,
  facturacionFiltro,
  pagoTransportistaFiltro,
  onFiltroFacturacion,
  onFiltroPago,
}: Props) {
  const activeId = activeFilterId(facturacionFiltro, pagoTransportistaFiltro);

  function toggleDesktop(id: FiltroId, tipo: 'facturacion' | 'pago') {
    if (activeId === id) {
      if (tipo === 'facturacion') onFiltroFacturacion('');
      else onFiltroPago('');
      return;
    }
    if (tipo === 'facturacion') onFiltroFacturacion(id);
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
