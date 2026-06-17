import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import {
  VIAJE_SORT_FIELDS,
  VIAJE_SORT_LABELS,
  etiquetaDirAsc,
  etiquetaDirDesc,
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

  function seleccionarCampo(field: ViajeSortField) {
    onChange(field, 'desc');
    setAbierto(false);
  }

  function seleccionarDir(field: ViajeSortField, dir: ViajeSortDir) {
    onChange(field, dir);
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
            return (
              <li key={field} role="option" aria-selected={activo}>
                {activo ? (
                  <div className="bg-vialto-mist/50 px-3 py-2">
                    <p className="text-sm font-medium text-vialto-charcoal">
                      {VIAJE_SORT_LABELS[field]}
                    </p>
                    <div className="mt-1.5 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => seleccionarDir(field, 'desc')}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                          sortDir === 'desc'
                            ? 'bg-vialto-fire text-white'
                            : 'border border-black/15 text-vialto-steel hover:bg-vialto-mist'
                        }`}
                      >
                        <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
                        {etiquetaDirDesc(field)}
                      </button>
                      <button
                        type="button"
                        onClick={() => seleccionarDir(field, 'asc')}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                          sortDir === 'asc'
                            ? 'bg-vialto-fire text-white'
                            : 'border border-black/15 text-vialto-steel hover:bg-vialto-mist'
                        }`}
                      >
                        <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
                        {etiquetaDirAsc(field)}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => seleccionarCampo(field)}
                    className="flex w-full items-center px-3 py-2 text-left text-sm text-vialto-charcoal hover:bg-vialto-mist/70"
                  >
                    {VIAJE_SORT_LABELS[field]}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
