import { Calculator, CircleCheck, FileClock, type LucideIcon } from 'lucide-react';
import { FiltroRapidoChip, FiltrosRapidosGrupo } from '@/components/listado/FiltroRapidoChip';
import type { ViajePagoTransportistaFiltro } from '@/lib/viajesFiltroPagoTransportista';

/** Conteos de los chips. undefined = ese conteo falló (el chip queda sin número y se puede usar). */
export type ViajesResumenFiltrosData = {
  sinFacturar?: number;
  /** Viajes con liquidación al transportista pendiente (`liquidacionEstado=sin_liquidar`). */
  sinLiquidar?: number;
  pagados?: number;
};

type FiltroId = 'sin_facturar' | 'sin_liquidar' | 'pagado';
type Tipo = 'facturacion' | 'liquidacion' | 'pago';

const OPCIONES: Array<{
  id: FiltroId;
  label: string;
  icon: LucideIcon;
  countKey: keyof ViajesResumenFiltrosData;
  tipo: Tipo;
}> = [
  { id: 'sin_facturar', label: 'Sin facturar', icon: FileClock, countKey: 'sinFacturar', tipo: 'facturacion' },
  { id: 'sin_liquidar', label: 'Sin liquidar', icon: Calculator, countKey: 'sinLiquidar', tipo: 'liquidacion' },
  { id: 'pagado', label: 'Pagados', icon: CircleCheck, countKey: 'pagados', tipo: 'pago' },
];

function opcionesVisibles(mostrarFiltroPago: boolean, mostrarFiltroLiquidacion: boolean) {
  return OPCIONES.filter(
    (o) =>
      (o.tipo !== 'pago' || mostrarFiltroPago) &&
      (o.tipo !== 'liquidacion' || mostrarFiltroLiquidacion),
  );
}

type Props = {
  /** null = se están contando: los chips no se aplican hasta saber si hay viajes. */
  resumen: ViajesResumenFiltrosData | null;
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
    <FiltrosRapidosGrupo ariaLabel="Filtros rápidos de viajes">
      {opciones.map((o) => {
        const active = valorActual[o.tipo] === o.id;
        const count = resumen?.[o.countKey];
        return (
          <FiltroRapidoChip
            key={o.id}
            label={o.label}
            icon={o.icon}
            active={active}
            count={count}
            cargando={resumen === null}
            onClick={() => toggle(o.id, o.tipo)}
          />
        );
      })}
    </FiltrosRapidosGrupo>
  );
}
