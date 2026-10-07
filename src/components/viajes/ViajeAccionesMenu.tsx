import { useMemo, useState } from 'react';
import {
  Banknote,
  Calculator,
  Download,
  Eye,
  FilePen,
  FileText,
  HandCoins,
  PlusCircle,
  Receipt,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { AccionesFila } from '@/components/ui/AccionesFila';
import type { AccionOpcion } from '@/components/ui/AccionesOpcionesSheet';
import type { Viaje } from '@/types/api';
import {
  arcaBloqueaFacturarUsd,
  arcaBloqueaLiquidarUsd,
  MSG_ARCA_NO_FACTURA_USD,
  MSG_ARCA_NO_LIQUIDA_USD,
} from '@/lib/arcaUsdRestriction';
import { viajePermiteAgregarGasto } from '@/lib/viajesIndicadores';
import {
  liquidacionElegidaDeViaje,
  viajePendienteComprobanteCliente,
  viajePendienteComprobanteTransportista,
  viajeRequiereComprobanteDual,
} from '@/lib/viajesComprobantes';
import { viajeRequierePagosTransportista } from '@/lib/viajesTransportistaPagos';
import { numeroVisibleViaje } from '@/lib/viajesFlota';
import { useFieldConfig } from '@/hooks/useFieldConfig';

interface Props {
  viaje: Viaje;
  /** Tenant con módulo emision-facturas-arca activo (bloqueo de USD al facturar). */
  hasFacturasArca?: boolean;
  /** Tenant con módulo emision-liquido-producto-arca activo (bloqueo de USD al liquidar). */
  hasLiquidoProductoArca?: boolean;
  hasExportacionActiva?: boolean;
  onVer: () => void;
  onAgregarGasto: () => void;
  onRegistrarPago: () => void;
  /** Factura al cliente. Sin pasar = el tenant no factura desde Vialto. */
  onFacturar?: () => void;
  /** Liquidación al transportista. Sin pasar = el tenant no tiene Liquidaciones. */
  onLiquidar?: () => void;
  onExportar: () => void;
  onVerFactura?: () => void;
  onVerLiquidacion?: () => void;
  /** Solo si la factura del viaje quedó con error de ARCA. */
  onReintentarFactura?: () => void;
  /** Solo si la liquidación del viaje quedó con error de ARCA. */
  onReintentarLiquidacion?: () => void;
  /** Solo si el viaje tiene una factura en borrador (sin emitir): reemplaza a "Facturar". */
  onContinuarFactura?: () => void;
  /** Solo si el viaje tiene una liquidación en borrador (sin emitir). */
  onContinuarLiquidacion?: () => void;
  onEliminar?: () => void;
  /** Si se pasa junto con `onOpenChange`, el abierto/cerrado pasa a ser controlado por el padre (ej. click en la fila de la tabla). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ViajeAccionesMenu({
  viaje,
  hasFacturasArca = false,
  hasLiquidoProductoArca = false,
  hasExportacionActiva = false,
  onVer,
  onAgregarGasto,
  onRegistrarPago,
  onFacturar,
  onLiquidar,
  onExportar,
  onVerFactura,
  onVerLiquidacion,
  onReintentarFactura,
  onReintentarLiquidacion,
  onContinuarFactura,
  onContinuarLiquidacion,
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
  const noCancelado = viaje.etapa !== 'cancelado';
  const permiteFacturar = Boolean(onFacturar) && noCancelado && viajePendienteComprobanteCliente(viaje);
  const permiteLiquidar =
    Boolean(onLiquidar) &&
    noCancelado &&
    viajeRequiereComprobanteDual(viaje) &&
    viajePendienteComprobanteTransportista(viaje);
  const facturarBloqueoArcaUsd = arcaBloqueaFacturarUsd(hasFacturasArca, viaje.monedaMonto)
    ? MSG_ARCA_NO_FACTURA_USD
    : null;
  const liquidarBloqueoArcaUsd = arcaBloqueaLiquidarUsd(
    hasLiquidoProductoArca,
    viaje.monedaPrecioTransportistaExterno,
  )
    ? MSG_ARCA_NO_LIQUIDA_USD
    : null;
  const permiteExportar = viaje.etapa !== 'cancelado' && hasExportacionActiva;

  const options = useMemo(() => {
    const items: AccionOpcion[] = [{ id: 'ver', label: 'Ver', icon: Eye, onClick: onVer }];

    if (onReintentarFactura) {
      items.push({
        id: 'reintentar-factura',
        label: 'Reintentar factura',
        icon: RotateCw,
        onClick: onReintentarFactura,
      });
    }
    if (onReintentarLiquidacion) {
      items.push({
        id: 'reintentar-liquidacion',
        label: 'Reintentar liquidación',
        icon: RotateCw,
        onClick: onReintentarLiquidacion,
      });
    }
    if (onContinuarFactura) {
      items.push({
        id: 'continuar-factura',
        label: 'Continuar factura',
        description: 'Tiene una factura en borrador sin emitir',
        icon: FilePen,
        onClick: onContinuarFactura,
      });
    }
    if (onContinuarLiquidacion) {
      items.push({
        id: 'continuar-liquidacion',
        label: 'Continuar liquidación',
        description: 'Tiene una liquidación en borrador sin emitir',
        icon: FilePen,
        onClick: onContinuarLiquidacion,
      });
    }

    if (viaje.facturaId && onVerFactura) {
      items.push({ id: 'ver-factura', label: 'Ver factura', icon: FileText, onClick: onVerFactura });
    }
    if (liquidacionElegidaDeViaje(viaje) && onVerLiquidacion) {
      items.push({ id: 'ver-liquidacion', label: 'Ver liquidación', icon: Calculator, onClick: onVerLiquidacion });
    }
    if (permiteFacturar && onFacturar) {
      items.push({
        id: 'facturar',
        label: 'Facturar',
        icon: Receipt,
        onClick: onFacturar,
        disabled: Boolean(facturarBloqueoArcaUsd),
        description: facturarBloqueoArcaUsd ?? undefined,
      });
    }
    if (permiteLiquidar && onLiquidar) {
      items.push({
        id: 'liquidar',
        label: 'Liquidar',
        icon: HandCoins,
        onClick: onLiquidar,
        disabled: Boolean(liquidarBloqueoArcaUsd),
        description: liquidarBloqueoArcaUsd ?? undefined,
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
    onReintentarFactura,
    onReintentarLiquidacion,
    onContinuarFactura,
    onContinuarLiquidacion,
    permiteFacturar,
    facturarBloqueoArcaUsd,
    onFacturar,
    permiteLiquidar,
    liquidarBloqueoArcaUsd,
    onLiquidar,
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
  'reintentar-factura',
  'reintentar-liquidacion',
  'continuar-factura',
  'continuar-liquidacion',
  'facturar',
  'liquidar',
  'gasto',
  'pago',
  'ver-factura',
  'ver-liquidacion',
  'exportar',
];
