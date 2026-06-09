import { useMemo, useState } from 'react';
import { AccionesMenuTrigger } from '@/components/ui/AccionesMenuTrigger';
import { AccionesOpcionesSheet, type AccionOpcion } from '@/components/ui/AccionesOpcionesSheet';
import type { Factura } from '@/types/api';

interface Props {
  factura: Factura;
  deleting: boolean;
  onVer: () => void;
  onEliminar: () => void;
}

export function FacturaAccionesMenu({ factura, deleting, onVer, onEliminar }: Props) {
  const [open, setOpen] = useState(false);

  const options = useMemo<AccionOpcion[]>(
    () => [
      { id: 'ver', label: 'Ver', onClick: onVer },
      {
        id: 'eliminar',
        label: deleting ? 'Eliminando…' : 'Eliminar',
        onClick: onEliminar,
        danger: true,
        disabled: deleting,
      },
    ],
    [onVer, onEliminar, deleting],
  );

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
