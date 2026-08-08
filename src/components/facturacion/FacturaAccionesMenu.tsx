import { useMemo, useState } from 'react';
import { Ban, Banknote, Eye, FileText, Receipt, Trash2 } from 'lucide-react';
import { AccionesMenuTrigger } from '@/components/ui/AccionesMenuTrigger';
import { AccionesOpcionesSheet, type AccionOpcion } from '@/components/ui/AccionesOpcionesSheet';
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
  /** Solo facturas a cliente. Se muestra siempre (aunque ya esté cobrada) — ver `onClick` del caller. */
  onMarcarCobrada?: () => void;
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
}: Props) {
  const [open, setOpen] = useState(false);

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
      opts.push({
        id: 'emitir-arca',
        label: 'Emitir a ARCA',
        icon: Receipt,
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
    if (onMarcarCobrada && factura.tipo === 'cliente' && !anulada) {
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
        icon: FileText,
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
    <>
      <AccionesMenuTrigger open={open} onClick={() => setOpen(true)} />

      <AccionesOpcionesSheet
        open={open}
        onClose={() => setOpen(false)}
        subtitle={factura.numero}
        options={options}
      />
    </>
  );
}
