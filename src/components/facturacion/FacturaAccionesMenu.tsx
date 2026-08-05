import { useMemo, useState } from 'react';
import { Eye, FileText, Receipt, Trash2 } from 'lucide-react';
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
}

export function FacturaAccionesMenu({
  factura,
  deleting,
  hasArca = false,
  onVer,
  onEliminar,
  onVerComprobante,
  onEmitirArca,
}: Props) {
  const [open, setOpen] = useState(false);

  const options = useMemo<AccionOpcion[]>(() => {
    const opts: AccionOpcion[] = [
      { id: 'ver', label: 'Ver', icon: Eye, onClick: onVer },
    ];
    const puedeEmitirArca =
      hasArca &&
      factura.tipo === 'cliente' &&
      factura.moneda !== 'USD' &&
      factura.arcaEstado !== 'autorizado' &&
      !factura.cae;
    if (puedeEmitirArca && onEmitirArca) {
      opts.push({
        id: 'emitir-arca',
        label: 'Emitir a ARCA',
        icon: Receipt,
        onClick: onEmitirArca,
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
    opts.push({
      id: 'eliminar',
      label: deleting ? 'Eliminando…' : 'Eliminar',
      icon: Trash2,
      onClick: onEliminar,
      danger: true,
      disabled: deleting,
    });
    return opts;
  }, [factura, hasArca, onVer, onEmitirArca, onVerComprobante, onEliminar, deleting]);

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
