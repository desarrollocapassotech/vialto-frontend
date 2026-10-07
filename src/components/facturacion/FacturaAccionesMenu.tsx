import { useMemo, useState } from 'react';
import { Ban, Banknote, Eye, FileMinus, FileText, Receipt, RotateCw, Trash2 } from 'lucide-react';
import { AccionesFila } from '@/components/ui/AccionesFila';
import type { AccionOpcion } from '@/components/ui/AccionesOpcionesSheet';
import type { Factura } from '@/types/api';

interface Props {
  factura: Factura;
  deleting: boolean;
  hasArca?: boolean;
  onVer: () => void;
  onEliminar: () => void;
  onVerComprobante?: () => void;
  onEmitirArca?: () => void;
  onAnular?: () => void;
  onVerNotaCredito?: () => void;
  /** Solo facturas a cliente, no anuladas y no ya cobradas. */
  onMarcarCobrada?: () => void;
  /** Si se pasa junto con `onOpenChange`, el abierto/cerrado pasa a ser controlado por el padre (ej. click en la fila de la tabla). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FacturaAccionesMenu({
  factura,
  deleting,
  hasArca = false,
  onVer,
  onEliminar,
  onVerComprobante,
  onEmitirArca,
  onAnular,
  onVerNotaCredito,
  onMarcarCobrada,
  open: openProp,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlado = openProp !== undefined;
  const open = controlado ? openProp : internalOpen;
  const setOpen = controlado ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const options = useMemo<AccionOpcion[]>(() => {
    const opts: AccionOpcion[] = [
      { id: 'ver', label: 'Ver', icon: Eye, onClick: onVer },
    ];
    const tieneCaeOriginal = Boolean(factura.cae);
    const anulada =
      factura.arcaEstado === 'anulado' || Boolean(factura.anulacionCae);
    const autorizada =
      factura.arcaEstado === 'autorizado' ||
      (tieneCaeOriginal && !anulada);
    const puedeEmitirArca =
      hasArca &&
      factura.tipo === 'cliente' &&
      factura.moneda !== 'USD' &&
      !autorizada &&
      !anulada &&
      !tieneCaeOriginal;
    if (puedeEmitirArca && onEmitirArca) {
      const conError = factura.arcaEstado === 'error';
      opts.push({
        id: conError ? 'reintentar' : 'emitir-arca',
        label: conError ? 'Reintentar emisión' : 'Emitir a ARCA',
        icon: conError ? RotateCw : Receipt,
        onClick: onEmitirArca,
      });
    }
    const puedeAnular =
      hasArca &&
      factura.tipo === 'cliente' &&
      !anulada &&
      tieneCaeOriginal &&
      (factura.arcaEstado === 'autorizado' ||
        factura.arcaEstado === 'pendiente_cae' ||
        factura.arcaEstado === 'error');
    if (puedeAnular && onAnular) {
      opts.push({
        id: 'anular',
        label: 'Anular',
        icon: Ban,
        onClick: onAnular,
        danger: true,
      });
    }
    if (
      onMarcarCobrada &&
      factura.tipo === 'cliente' &&
      !anulada &&
      // Con error de AFIP no se cobra: primero hay que reintentar la emisión.
      factura.arcaEstado !== 'error' &&
      !factura.cobrado
    ) {
      opts.push({
        id: 'marcar-cobrada',
        label: 'Marcar como cobrada',
        icon: Banknote,
        onClick: onMarcarCobrada,
      });
    }
    if (onVerComprobante && factura.comprobanteUrl?.trim()) {
      opts.push({
        id: 'comprobante',
        label: 'Ver comprobante',
        icon: FileText,
        onClick: onVerComprobante,
      });
    }
    if (
      anulada &&
      onVerNotaCredito &&
      (factura.notaCreditoUrl?.trim() || factura.anulacionCae)
    ) {
      opts.push({
        id: 'nota-credito',
        label: 'Ver Nota de Crédito',
        icon: FileMinus,
        onClick: onVerNotaCredito,
      });
    }
    const puedeEliminar = !autorizada && !anulada;
    if (puedeEliminar) {
      opts.push({
        id: 'eliminar',
        label: deleting ? 'Eliminando…' : 'Eliminar',
        icon: Trash2,
        onClick: onEliminar,
        danger: true,
        disabled: deleting,
      });
    }
    return opts;
  }, [
    factura,
    hasArca,
    onVer,
    onEmitirArca,
    onAnular,
    onMarcarCobrada,
    onVerComprobante,
    onVerNotaCredito,
    onEliminar,
    deleting,
  ]);

  return (
    <AccionesFila
      options={options}
      destacadas={FACTURA_ACCIONES_DESTACADAS}
      subtitle={factura.numero}
      open={open}
      onOpenChange={setOpen}
    />
  );
}

/** Orden de prioridad de las acciones que se muestran como ícono en la grilla. */
/** "Ver" queda solo en el desplegable: tocar la fila ya abre las acciones (igual que Viajes). */
const FACTURA_ACCIONES_DESTACADAS = [
  'reintentar',
  'emitir-arca',
  'marcar-cobrada',
  'anular',
  'comprobante',
  'nota-credito',
];
