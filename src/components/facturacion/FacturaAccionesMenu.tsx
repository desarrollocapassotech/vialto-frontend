import { useEffect, useRef, useState } from 'react';
import type { Factura } from '@/types/api';

interface Props {
  factura: Factura;
  deleting: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}

export function FacturaAccionesMenu({ factura: _factura, deleting, onEditar, onEliminar }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
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

      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[140px] border border-black/20 bg-white shadow-lg">
          {item('Editar', onEditar)}
          {item('Eliminar', onEliminar, { danger: true, disabled: deleting })}
        </div>
      )}
    </div>
  );
}
