import { FiltroRapidoChip } from '@/components/listado/FiltroRapidoChip';
import type { ViajePagoTransportistaFiltro } from '@/lib/viajesFiltroPagoTransportista';

export type ViajesResumenFiltrosData = {
  sinFacturar: number;
  /** Viajes con liquidación al transportista pendiente (`liquidacionEstado=sin_liquidar`). */
  sinLiquidar: number;
  pagados: number;
};

type FiltroId = 'sin_facturar' | 'sin_liquidar' | 'pagado';
type Tipo = 'facturacion' | 'liquidacion' | 'pago';

const OPCIONES: Array<{
  id: FiltroId;
  label: string;
  countKey: keyof ViajesResumenFiltrosData;
  tipo: Tipo;
}> = [
  { id: 'sin_facturar', label: 'Sin facturar', countKey: 'sinFacturar', tipo: 'facturacion' },
  { id: 'sin_liquidar', label: 'Sin liquidar', countKey: 'sinLiquidar', tipo: 'liquidacion' },
  { id: 'pagado', label: 'Pagados', countKey: 'pagados', tipo: 'pago' },
];

/** Chips que marcan algo pendiente ("Pagados" no: es un estado resuelto, casi siempre > 0). */
const PENDIENTES: ReadonlySet<FiltroId> = new Set(['sin_facturar', 'sin_liquidar']);

function opcionesVisibles(mostrarFiltroPago: boolean, mostrarFiltroLiquidacion: boolean) {
  return OPCIONES.filter(
    (o) =>
      (o.tipo !== 'pago' || mostrarFiltroPago) &&
      (o.tipo !== 'liquidacion' || mostrarFiltroLiquidacion),
  );
}

/** Chips visibles de pendientes con su contador, para `FiltrosRapidosBoton` (palpita y tooltip). */
export function resumenPendientes(
  resumen: ViajesResumenFiltrosData,
  { mostrarFiltroPago = true, mostrarFiltroLiquidacion = true } = {},
): { label: string; count: number }[] {
  return opcionesVisibles(mostrarFiltroPago, mostrarFiltroLiquidacion)
    .filter((o) => PENDIENTES.has(o.id))
    .map((o) => ({ label: o.label, count: resumen[o.countKey] }));
}

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
  const opciones = opcionesVisibles(mostrarFiltroPago, mostrarFiltroLiquidacion);

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
          <FiltroRapidoChip
            key={o.id}
            label={o.label}
            active={active}
            count={count}
            onClick={() => toggle(o.id, o.tipo)}
          />
        );
      })}
    </div>
  );
}
