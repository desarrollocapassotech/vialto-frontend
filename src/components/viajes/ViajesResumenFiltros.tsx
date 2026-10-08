import { selectorTabClass } from '@/components/ui/SelectorOpcionesSheet';
import type { ViajePagoTransportistaFiltro } from '@/lib/viajesFiltroPagoTransportista';

export type ViajesResumenFiltrosData = {
  sinFacturar: number;
  sinCobrar: number;
  /** Viajes con liquidación al transportista pendiente (`liquidacionEstado=sin_liquidar`). */
  sinLiquidar: number;
  sinPagar: number;
  pagados: number;
};

type FiltroId = 'sin_facturar' | 'facturado' | 'sin_liquidar' | 'sin_pagar' | 'pagado';
type Tipo = 'facturacion' | 'liquidacion' | 'pago';

const OPCIONES: Array<{
  id: FiltroId;
  label: string;
  countKey: keyof ViajesResumenFiltrosData;
  tipo: Tipo;
}> = [
  { id: 'sin_facturar', label: 'Sin facturar', countKey: 'sinFacturar', tipo: 'facturacion' },
  { id: 'facturado', label: 'Sin cobrar', countKey: 'sinCobrar', tipo: 'facturacion' },
  { id: 'sin_liquidar', label: 'Sin liquidar', countKey: 'sinLiquidar', tipo: 'liquidacion' },
  { id: 'sin_pagar', label: 'Sin pagar', countKey: 'sinPagar', tipo: 'pago' },
  { id: 'pagado', label: 'Pagados', countKey: 'pagados', tipo: 'pago' },
];

type Props = {
  resumen: ViajesResumenFiltrosData;
  facturacionFiltro: string;
  /** Mismo filtro que el de la columna "Liquidación" de la grilla. */
  liquidacionFiltro: string;
  pagoTransportistaFiltro: ViajePagoTransportistaFiltro;
  onFiltroFacturacion: (val: string) => void;
  onFiltroLiquidacion: (val: string) => void;
  onFiltroPago: (val: ViajePagoTransportistaFiltro) => void;
  /** false = el tenant tiene oculto "Pagos al transportista" — no mostrar los chips de pago. */
  mostrarFiltroPago?: boolean;
  /** false = el tenant no liquida a transportistas (sin columna Liquidación) — no mostrar "Sin liquidar". */
  mostrarFiltroLiquidacion?: boolean;
};

export function ViajesResumenFiltros({
  resumen,
  facturacionFiltro,
  liquidacionFiltro,
  pagoTransportistaFiltro,
  onFiltroFacturacion,
  onFiltroLiquidacion,
  onFiltroPago,
  mostrarFiltroPago = true,
  mostrarFiltroLiquidacion = true,
}: Props) {
  // Facturación y pago son excluyentes entre sí (los maneja la página); liquidación es
  // independiente y se puede combinar (ej. "Sin cobrar" + "Sin liquidar").
  const valorActual: Record<Tipo, string> = {
    facturacion: facturacionFiltro,
    liquidacion: liquidacionFiltro,
    pago: pagoTransportistaFiltro,
  };
  const opciones = OPCIONES.filter(
    (o) =>
      (o.tipo !== 'pago' || mostrarFiltroPago) &&
      (o.tipo !== 'liquidacion' || mostrarFiltroLiquidacion),
  );

  function toggle(id: FiltroId, tipo: Tipo) {
    const nuevo = valorActual[tipo] === id ? '' : id;
    if (tipo === 'facturacion') onFiltroFacturacion(nuevo);
    else if (tipo === 'liquidacion') onFiltroLiquidacion(nuevo);
    else onFiltroPago(nuevo as ViajePagoTransportistaFiltro);
  }

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-0.5 lg:flex-wrap lg:pb-0"
      role="tablist"
      aria-label="Filtros rápidos de viajes"
    >
      {opciones.map((o) => {
        const active = valorActual[o.tipo] === o.id;
        const count = resumen[o.countKey];
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => toggle(o.id, o.tipo)}
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
