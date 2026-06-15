import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import {
  VIAJE_SORT_FIELDS,
  VIAJE_SORT_LABELS,
  etiquetaViajeOrdenamiento,
  type ViajeSortDir,
  type ViajeSortField,
} from '@/lib/viajesOrdenamiento';

type Props = {
  sortBy: ViajeSortField;
  sortDir: ViajeSortDir;
  disabled?: boolean;
  onChange: (sortBy: ViajeSortField, sortDir: ViajeSortDir) => void;
};

export function ViajesOrdenamientoMenu({ sortBy, sortDir, disabled, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [abierto]);

  function seleccionar(field: ViajeSortField) {
    if (field === sortBy) {
      onChange(field, sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      onChange(field, 'desc');
    }
    setAbierto(false);
  }

  const DirIcon = sortDir === 'desc' ? ArrowDown : ArrowUp;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={`Ordenar por: ${etiquetaViajeOrdenamiento(sortBy, sortDir)}`}
        className="inline-flex h-10 items-center gap-2 border border-black/15 bg-white px-3 text-sm text-vialto-charcoal hover:bg-vialto-mist/80 disabled:opacity-50 disabled:pointer-events-none"
      >
        <ArrowUpDown className="h-4 w-4 shrink-0 text-vialto-steel" aria-hidden />
        <span className="hidden sm:inline max-w-[14rem] truncate">
          {VIAJE_SORT_LABELS[sortBy]}
        </span>
        <DirIcon className="h-4 w-4 shrink-0 text-vialto-fire" aria-hidden />
      </button>

      {abierto && (
        <ul
          role="listbox"
          aria-label="Criterio de ordenamiento"
          className="absolute right-0 z-30 mt-1 min-w-[15rem] border border-black/10 bg-white py-1 shadow-lg"
        >
          {VIAJE_SORT_FIELDS.map((field) => {
            const activo = field === sortBy;
            const Icon = activo ? (sortDir === 'desc' ? ArrowDown : ArrowUp) : null;
            return (
              <li key={field} role="option" aria-selected={activo}>
                <button
                  type="button"
                  onClick={() => seleccionar(field)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-vialto-mist/70 ${
                    activo ? 'bg-vialto-mist/50 font-medium text-vialto-charcoal' : 'text-vialto-charcoal'
                  }`}
                >
                  <span>{VIAJE_SORT_LABELS[field]}</span>
                  {Icon ? <Icon className="h-4 w-4 shrink-0 text-vialto-fire" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
