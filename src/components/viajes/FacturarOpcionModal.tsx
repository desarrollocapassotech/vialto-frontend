import { useEffect, useState } from 'react';
import type { Factura } from '@/types/api';

type Props = {
  open: boolean;
  facturas: Factura[];
  busy?: boolean;
  onNuevaFactura: () => void;
  onAgregarAExistente: (facturaId: string) => void;
  onClose: () => void;
};

export function FacturarOpcionModal({
  open,
  facturas,
  busy = false,
  onNuevaFactura,
  onAgregarAExistente,
  onClose,
}: Props) {
  const [opcion, setOpcion] = useState<'nueva' | 'existente'>('nueva');
  const [facturaSeleccionadaId, setFacturaSeleccionadaId] = useState('');

  // Resetear selección cada vez que el modal se abre con nuevas facturas
  useEffect(() => {
    if (open) {
      setOpcion('nueva');
      setFacturaSeleccionadaId(facturas[0]?.id ?? '');
    }
  }, [open, facturas]);

  if (!open) return null;

  function handleConfirm() {
    if (opcion === 'nueva') {
      onNuevaFactura();
    } else {
      if (!facturaSeleccionadaId) return;
      onAgregarAExistente(facturaSeleccionadaId);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="facturar-opcion-title"
    >
      <div className="w-full max-w-md rounded border border-black/15 bg-white p-5 shadow-lg">
        <h2
          id="facturar-opcion-title"
          className="text-sm font-semibold text-vialto-charcoal"
        >
          Facturar viaje
        </h2>
        <p className="mt-2 text-xs text-vialto-steel">
          Este cliente ya tiene facturas creadas. ¿Querés crear una nueva o
          agregar el viaje a una existente?
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <label className="flex cursor-pointer items-center gap-3 rounded border border-black/10 px-3 py-2.5 hover:bg-vialto-mist">
            <input
              type="radio"
              name="facturar-opcion"
              value="nueva"
              checked={opcion === 'nueva'}
              onChange={() => setOpcion('nueva')}
              disabled={busy}
            />
            <span className="text-sm text-vialto-charcoal">
              Crear nueva factura
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-3 rounded border border-black/10 px-3 py-2.5 hover:bg-vialto-mist">
            <input
              type="radio"
              name="facturar-opcion"
              value="existente"
              checked={opcion === 'existente'}
              onChange={() => setOpcion('existente')}
              disabled={busy}
            />
            <span className="text-sm text-vialto-charcoal">
              Agregar a factura existente
            </span>
          </label>
        </div>

        {opcion === 'existente' && (
          <div className="mt-3 flex flex-col gap-1">
            <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
              Seleccioná la factura
            </span>
            <select
              value={facturaSeleccionadaId}
              onChange={(e) => setFacturaSeleccionadaId(e.target.value)}
              disabled={busy}
              className="h-9 border border-black/15 bg-white px-2 text-sm"
            >
              {facturas.map((f) => (
                <option key={f.id} value={f.id}>
                  #{f.numero} — {f.estado}
                  {f.viajeIds.length > 0
                    ? ` (${f.viajeIds.length} viaje${f.viajeIds.length !== 1 ? 's' : ''})`
                    : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || (opcion === 'existente' && !facturaSeleccionadaId)}
            onClick={handleConfirm}
            className="text-xs uppercase tracking-wider px-3 py-1.5 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
