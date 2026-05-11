import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Factura } from '@/types/api';

interface Props {
  factura: Factura;
  deleting: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}

type MenuPos = { top?: number; bottom?: number; right: number };

export function FacturaAccionesMenu({ factura: _factura, deleting, onEditar, onEliminar }: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  function handleToggle() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const right = window.innerWidth - rect.right;
      if (spaceBelow < 120) {
        setMenuPos({ bottom: window.innerHeight - rect.top, right });
      } else {
        setMenuPos({ top: rect.bottom + 4, right });
      }
    }
    setOpen((o) => !o);
  }

  function item(
    label: string,
    onClick: () => void,
    opts: { danger?: boolean; disabled?: boolean } = {},
  ) {
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
          style={{ position: 'fixed', ...menuPos, zIndex: 9999 }}
          className="min-w-[140px] border border-black/20 bg-white shadow-lg"
        >
          {item('Editar', onEditar)}
          {item('Eliminar', onEliminar, { danger: true, disabled: deleting })}
        </div>,
        document.body,
      )}
    </>
  );
}
