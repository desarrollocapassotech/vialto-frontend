import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Check } from 'lucide-react';
import {
  VIAJE_SORT_FIELDS,
  VIAJE_SORT_LABELS,
  etiquetaDirAsc,
  etiquetaDirDesc,
  etiquetaViajeOrdenamiento,
  type ViajeSortDir,
  type ViajeSortField,
} from '@/lib/viajesOrdenamiento';
import { modalOverlayClass } from '@/lib/modalLayers';

type Props = {
  sortBy: ViajeSortField;
  sortDir: ViajeSortDir;
  disabled?: boolean;
  onChange: (sortBy: ViajeSortField, sortDir: ViajeSortDir) => void;
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export function ViajesOrdenamientoMenu({ sortBy, sortDir, disabled, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!abierto || isMobile) return;
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
  }, [abierto, isMobile]);

  useEffect(() => {
    if (!abierto || !isMobile) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, isMobile]);

  function seleccionarCampo(field: ViajeSortField) {
    onChange(field, 'desc');
    setAbierto(false);
  }

  function seleccionarDir(field: ViajeSortField, dir: ViajeSortDir) {
    onChange(field, dir);
    setAbierto(false);
  }

  const DirIcon = sortDir === 'desc' ? ArrowDown : ArrowUp;

  const trigger = (
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
      <span className="hidden max-w-[14rem] truncate sm:inline">
        {VIAJE_SORT_LABELS[sortBy]}
      </span>
      <DirIcon className="h-4 w-4 shrink-0 text-vialto-fire" aria-hidden />
    </button>
  );

  function renderOpciones(mobile: boolean) {
    return VIAJE_SORT_FIELDS.map((field) => {
      const activo = field === sortBy;
      const pillClass = mobile
        ? 'inline-flex flex-1 items-center justify-center gap-2 rounded min-h-11 px-3 text-sm transition-colors'
        : 'inline-flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors';
      return (
        <li key={field} role="option" aria-selected={activo}>
          {activo ? (
            <div className="bg-vialto-mist/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-vialto-fire" aria-hidden />
                <p className="text-sm font-medium text-vialto-charcoal">
                  {VIAJE_SORT_LABELS[field]}
                </p>
              </div>
              <div className={`mt-2 flex gap-2 ${mobile ? '' : 'flex-wrap gap-1.5 pl-5'}`}>
                <button
                  type="button"
                  onClick={() => seleccionarDir(field, 'desc')}
                  className={`${pillClass} ${
                    sortDir === 'desc'
                      ? 'bg-vialto-fire text-white'
                      : 'border border-black/15 text-vialto-steel hover:bg-vialto-mist'
                  }`}
                >
                  <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {etiquetaDirDesc(field)}
                </button>
                <button
                  type="button"
                  onClick={() => seleccionarDir(field, 'asc')}
                  className={`${pillClass} ${
                    sortDir === 'asc'
                      ? 'bg-vialto-fire text-white'
                      : 'border border-black/15 text-vialto-steel hover:bg-vialto-mist'
                  }`}
                >
                  <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {etiquetaDirAsc(field)}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => seleccionarCampo(field)}
              className={`flex w-full items-center px-4 text-left text-sm text-vialto-charcoal hover:bg-vialto-mist/70 ${
                mobile ? 'min-h-14' : 'py-2.5'
              }`}
            >
              {VIAJE_SORT_LABELS[field]}
            </button>
          )}
        </li>
      );
    });
  }

  const mobileModal = abierto && isMobile
    ? createPortal(
        <div
          className={modalOverlayClass}
          role="presentation"
          onClick={() => setAbierto(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ordenar viajes"
            className="flex w-full flex-col overflow-hidden rounded-t-xl border border-black/10 bg-white shadow-lg sm:max-w-sm sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 py-4">
              <h2 className="font-[family-name:var(--font-display)] text-lg tracking-wide text-vialto-charcoal">
                Ordenar viajes
              </h2>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="inline-flex h-11 w-11 items-center justify-center text-vialto-steel hover:bg-vialto-mist"
              >
                ×
              </button>
            </div>

            <ul role="listbox" aria-label="Criterio de ordenamiento" className="divide-y divide-black/5">
              {renderOpciones(true)}
            </ul>

            <div className="shrink-0 border-t border-black/10 p-4">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="inline-flex min-h-11 w-full items-center justify-center bg-vialto-charcoal px-4 font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-white transition-colors hover:bg-vialto-graphite"
              >
                Listo
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  const desktopDropdown = abierto && !isMobile
    ? (
        <ul
          role="listbox"
          aria-label="Criterio de ordenamiento"
          className="absolute right-0 z-30 mt-1 w-56 border border-black/10 bg-white py-1 shadow-lg"
        >
          {renderOpciones(false)}
        </ul>
      )
    : null;

  return (
    <div ref={rootRef} className="relative">
      {trigger}
      {mobileModal}
      {desktopDropdown}
    </div>
  );
}
