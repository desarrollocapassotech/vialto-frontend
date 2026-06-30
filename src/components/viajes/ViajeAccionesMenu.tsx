import { useMemo, useState } from 'react';
import { Banknote, Download, Eye, FileText, PlusCircle, Receipt, Trash2 } from 'lucide-react';
import { AccionesMenuTrigger } from '@/components/ui/AccionesMenuTrigger';
import { AccionesOpcionesSheet, type AccionOpcion } from '@/components/ui/AccionesOpcionesSheet';
import type { Viaje } from '@/types/api';
import {
  viajePermiteAgregarGasto,
} from '@/lib/viajesEstados';
import { viajePermiteBotonFacturar } from '@/lib/viajesComprobantes';
import { viajeRequierePagosTransportista } from '@/lib/viajesTransportistaPagos';

function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

interface Props {
  viaje: Viaje;
  onVer: () => void;
  onAgregarGasto: () => void;
  onRegistrarPago: () => void;
  onFacturar: () => void;
  onExportar: () => void;
  onVerFactura?: () => void;
  onEliminar?: () => void;
}

export function ViajeAccionesMenu({
  viaje,
  onVer,
  onAgregarGasto,
  onRegistrarPago,
  onFacturar,
  onExportar,
  onVerFactura,
  onEliminar,
}: Props) {
  const [open, setOpen] = useState(false);

  const permitePago = viajeRequierePagosTransportista(viaje) && viaje.estado !== 'cancelado';
  const permiteGasto = viajePermiteAgregarGasto(viaje.estado);
  const permiteFacturar = viajePermiteBotonFacturar(viaje);
  const permiteExportar = viaje.estado !== 'cancelado';

  const options = useMemo(() => {
    const items: AccionOpcion[] = [{ id: 'ver', label: 'Ver', icon: Eye, onClick: onVer }];

    if (viaje.facturaId && onVerFactura) {
      items.push({ id: 'ver-factura', label: 'Ver factura', icon: FileText, onClick: onVerFactura });
    }
    if (permiteFacturar) {
      items.push({
        id: 'facturar',
        label: 'Facturar',
        icon: Receipt,
        onClick: onFacturar,
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
    viaje.facturaId,
    onVer,
    onVerFactura,
    permiteFacturar,
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
    <>
      <AccionesMenuTrigger open={open} onClick={() => setOpen(true)} />

      <AccionesOpcionesSheet
        open={open}
        onClose={() => setOpen(false)}
        subtitle={[
          viaje.origen && viaje.destino ? `${viaje.origen} → ${viaje.destino}` : null,
          viaje.fechaCarga && viaje.fechaDescarga
            ? `${fmtDate(viaje.fechaCarga)} — ${fmtDate(viaje.fechaDescarga)}`
            : viaje.fechaCarga
              ? fmtDate(viaje.fechaCarga)
              : null,
        ].filter(Boolean).join(' · ') || `Viaje #${viaje.numero}`}
        options={options}
      />
    </>
  );
}
