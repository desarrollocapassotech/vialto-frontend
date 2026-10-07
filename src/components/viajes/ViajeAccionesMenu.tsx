import { useMemo, useState } from 'react';
import { Banknote, Download, Eye, FileText, Calculator, PlusCircle, Receipt, Trash2 } from 'lucide-react';
import { AccionesFila } from '@/components/ui/AccionesFila';
import type { AccionOpcion } from '@/components/ui/AccionesOpcionesSheet';
import type { Viaje } from '@/types/api';
import { motivoBloqueoAccionFacturarArcaUsd } from '@/lib/arcaUsdRestriction';
import { viajePermiteAgregarGasto } from '@/lib/viajesIndicadores';
import { viajePermiteBotonFacturar, liquidacionElegidaDeViaje } from '@/lib/viajesComprobantes';
import { viajeRequierePagosTransportista } from '@/lib/viajesTransportistaPagos';
import { numeroVisibleViaje } from '@/lib/viajesFlota';
import { useFieldConfig } from '@/hooks/useFieldConfig';

interface Props {
  viaje: Viaje;
  /** Tenant con módulo emision-facturas-arca activo (bloqueo de USD al facturar). */
  hasFacturasArca?: boolean;
  hasExportacionActiva?: boolean;
  onVer: () => void;
  onAgregarGasto: () => void;
  onRegistrarPago: () => void;
  onFacturar: () => void;
  onExportar: () => void;
  onVerFactura?: () => void;
  onVerLiquidacion?: () => void;
  onEliminar?: () => void;
  /** Si se pasa junto con `onOpenChange`, el abierto/cerrado pasa a ser controlado por el padre (ej. click en la fila de la tabla). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ViajeAccionesMenu({
  viaje,
  hasFacturasArca = false,
  hasExportacionActiva = false,
  onVer,
  onAgregarGasto,
  onRegistrarPago,
  onFacturar,
  onExportar,
  onVerFactura,
  onVerLiquidacion,
  onEliminar,
  open: openProp,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlado = openProp !== undefined;
  const open = controlado ? openProp : internalOpen;
  const setOpen = controlado ? (onOpenChange ?? (() => {})) : setInternalOpen;
  const { isVisible } = useFieldConfig('viajes');

  const permitePago =
    isVisible('detalle_viaje', 'pagosTransportista') &&
    viajeRequierePagosTransportista(viaje) &&
    viaje.etapa !== 'cancelado';
  const permiteGasto =
    isVisible('detalle_viaje', 'otrosGastos') && viajePermiteAgregarGasto(viaje);
  const permiteFacturar = viajePermiteBotonFacturar(viaje);
  const facturarBloqueoArcaUsd = motivoBloqueoAccionFacturarArcaUsd(hasFacturasArca, viaje);
  const permiteExportar = viaje.etapa !== 'cancelado' && hasExportacionActiva;

  const options = useMemo(() => {
    const items: AccionOpcion[] = [{ id: 'ver', label: 'Ver', icon: Eye, onClick: onVer }];

    if (viaje.facturaId && onVerFactura) {
      items.push({ id: 'ver-factura', label: 'Ver factura', icon: FileText, onClick: onVerFactura });
    }
    if (liquidacionElegidaDeViaje(viaje) && onVerLiquidacion) {
      items.push({ id: 'ver-liquidacion', label: 'Ver liquidación', icon: Calculator, onClick: onVerLiquidacion });
    }
    if (permiteFacturar) {
      items.push({
        id: 'facturar',
        label: 'Facturar / Liquidar',
        icon: Receipt,
        onClick: onFacturar,
        disabled: Boolean(facturarBloqueoArcaUsd),
        description: facturarBloqueoArcaUsd ?? undefined,
      });
    }
    if (permiteGasto) {
      items.push({ id: 'gasto', label: 'Agregar gasto', icon: PlusCircle, onClick: onAgregarGasto });
    }
    if (permitePago) {
      items.push({
        id: 'pago',
        label: 'Registrar pago transportista',
        icon: Banknote,
        onClick: onRegistrarPago,
      });
    }
    if (permiteExportar) {
      items.push({ id: 'exportar', label: 'Exportar', icon: Download, onClick: onExportar });
    }
    if (onEliminar) {
      items.push({ id: 'eliminar', label: 'Eliminar', icon: Trash2, onClick: onEliminar, danger: true });
    }

    return items;
  }, [
    viaje,
    onVer,
    onVerFactura,
    onVerLiquidacion,
    permiteFacturar,
    facturarBloqueoArcaUsd,
    onFacturar,
    permiteGasto,
    onAgregarGasto,
    permitePago,
    onRegistrarPago,
    permiteExportar,
    onExportar,
    onEliminar,
  ]);

  return (
    <AccionesFila
      options={options}
      destacadas={VIAJE_ACCIONES_DESTACADAS}
      subtitle={`Viaje #${numeroVisibleViaje(viaje)}`}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

/**
 * Orden de prioridad de las acciones que se muestran como ícono en la grilla.
 * "Ver" queda solo en el desplegable: tocar la fila ya abre las acciones.
 */
const VIAJE_ACCIONES_DESTACADAS = [
  'facturar',
  'gasto',
  'pago',
  'ver-factura',
  'ver-liquidacion',
  'exportar',
];
