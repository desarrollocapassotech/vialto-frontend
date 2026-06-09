import { useMemo, useState } from 'react';
import { AccionesMenuTrigger } from '@/components/ui/AccionesMenuTrigger';
import { AccionesOpcionesSheet, type AccionOpcion } from '@/components/ui/AccionesOpcionesSheet';
import type { Viaje } from '@/types/api';
import {
  viajePermiteAgregarGasto,
  viajeEstadoPermiteBotonFacturar,
} from '@/lib/viajesEstados';
import { viajeRequierePagosTransportista } from '@/lib/viajesTransportistaPagos';

interface Props {
  viaje: Viaje;
  onVer: () => void;
  onAgregarGasto: () => void;
  onRegistrarPago: () => void;
  onFacturar: () => void;
  onExportar: () => void;
  onVerFactura?: () => void;
  /** Si se provee, reemplaza "Facturar" con "Emitir CVLP" cuando el módulo liquidaciones-arca está activo. */
  onEmitirCvlp?: () => void;
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
  onEmitirCvlp,
  onEliminar,
}: Props) {
  const [open, setOpen] = useState(false);

  const permitePago = viajeRequierePagosTransportista(viaje) && viaje.estado !== 'cancelado';
  const permiteGasto = viajePermiteAgregarGasto(viaje.estado);
  const permiteFacturar = viajeEstadoPermiteBotonFacturar(viaje.estado);
  const permiteExportar = viaje.estado !== 'cancelado';

  const options = useMemo(() => {
    const items: AccionOpcion[] = [{ id: 'ver', label: 'Ver', onClick: onVer }];

    if (viaje.facturaId && onVerFactura) {
      items.push({ id: 'ver-factura', label: 'Ver factura', onClick: onVerFactura });
    }
    if (permiteFacturar && onEmitirCvlp) {
      items.push({ id: 'emitir-cvlp', label: 'Emitir comprobante', onClick: onEmitirCvlp });
    } else if (permiteFacturar) {
      items.push({ id: 'facturar', label: 'Facturar', onClick: onFacturar });
    }
    if (permiteGasto) {
      items.push({ id: 'gasto', label: 'Agregar gasto', onClick: onAgregarGasto });
    }
    if (permitePago) {
      items.push({
        id: 'pago',
        label: 'Registrar pago transportista',
        onClick: onRegistrarPago,
      });
    }
    if (permiteExportar) {
      items.push({ id: 'exportar', label: 'Exportar', onClick: onExportar });
    }
    if (onEliminar) {
      items.push({ id: 'eliminar', label: 'Eliminar', onClick: onEliminar, danger: true });
    }

    return items;
  }, [
    viaje.facturaId,
    onVer,
    onVerFactura,
    permiteFacturar,
    onEmitirCvlp,
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
        subtitle={`Viaje #${viaje.numero}`}
        options={options}
      />
    </>
  );
}
