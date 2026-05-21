import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

type MenuPos = { top?: number; bottom?: number; right: number };

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
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /** Panel en portal (body); sin esto, mousedown en un ítem cierra antes del click y rompe las acciones. */
  const menuPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t)) return;
      if (menuPanelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const permitePago = viajeRequierePagosTransportista(viaje) && viaje.estado !== 'cancelado';
  const permiteGasto = viajePermiteAgregarGasto(viaje.estado);
  const permiteFacturar = viajeEstadoPermiteBotonFacturar(viaje.estado);
  const permiteExportar = viaje.estado !== 'cancelado';

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const right = window.innerWidth - rect.right;
      if (spaceBelow < 220) {
        setMenuPos({ bottom: window.innerHeight - rect.top, right });
      } else {
        setMenuPos({ top: rect.bottom + 4, right });
      }
    }
    setOpen((o) => !o);
  }

  function item(label: string, onClick: () => void, opts: { danger?: boolean; disabled?: boolean } = {}) {
    return (
      <button
        key={label}
        type="button"
        disabled={opts.disabled}
        onClick={() => { setOpen(false); onClick(); }}
        className={[
          'w-full px-4 py-2 text-left text-xs uppercase tracking-wider',
          'hover:bg-vialto-mist disabled:opacity-40 disabled:cursor-not-allowed',
          opts.danger ? 'text-red-700 hover:bg-red-50' : 'text-vialto-charcoal',
        ].join(' ')}
      >
        {label}
      </button>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        title="Acciones"
        className="inline-flex h-8 w-8 items-center justify-center border border-black/20 text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="flex gap-[3px] items-center">
          <span className="block h-[3px] w-[3px] rounded-full bg-current" />
          <span className="block h-[3px] w-[3px] rounded-full bg-current" />
          <span className="block h-[3px] w-[3px] rounded-full bg-current" />
        </span>
      </button>

      {open && menuPos && createPortal(
        <div
          ref={menuPanelRef}
          style={{ position: 'fixed', ...menuPos, zIndex: 9999 }}
          className="min-w-[160px] border border-black/20 bg-white shadow-lg"
        >
          {item('Ver', onVer)}
          {viaje.facturaId && onVerFactura && item('Ver factura', onVerFactura)}
          {permiteFacturar && onEmitirCvlp && item('Emitir comprobante', onEmitirCvlp)}
          {permiteFacturar && !onEmitirCvlp && item('Facturar', onFacturar)}
          {permiteGasto && item('+ Gasto', onAgregarGasto)}
          {permitePago && item('+ Pago transportista', onRegistrarPago)}
          {permiteExportar && item('Exportar', onExportar)}
          {onEliminar && item('Eliminar', onEliminar, { danger: true })}
        </div>,
        document.body,
      )}
    </>
  );
}
