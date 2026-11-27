import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ordenarAlfabetico } from '@/lib/ordenAlfabetico';

export type OpcionPresentacion = {
  id: string;
  nombre: string;
  activo?: boolean;
};

export type PresentacionSearchableSelectProps = {
  value: string;
  onChange: (presentacionId: string) => void;
  opciones: OpcionPresentacion[];
  triggerClassName: string;
  disabled?: boolean;
  id?: string;
  onNuevaPresentacion?: () => void;
};

const MENU_Z = 300;

export function PresentacionSearchableSelect({
  value,
  onChange,
  opciones,
  triggerClassName,
  disabled = false,
  id,
  onNuevaPresentacion,
}: PresentacionSearchableSelectProps) {
  const sinValor = '— Unidad —';
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const ordenadas = useMemo(() => ordenarAlfabetico(opciones, (o) => o.nombre), [opciones]);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ordenadas;
    return ordenadas.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [ordenadas, search]);

  const seleccionada = opciones.find((x) => x.id === value);

  const actualizarRect = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 180) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    actualizarRect();
  }, [open, actualizarRect]);

  useEffect(() => {
    if (!open) return;
    const fn = () => actualizarRect();
    window.addEventListener('resize', fn);
    window.addEventListener('scroll', fn, true);
    return () => {
      window.removeEventListener('resize', fn);
      window.removeEventListener('scroll', fn, true);
    };
  }, [open, actualizarRect]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      const node = e.target as Node;
      if (btnRef.current?.contains(node) || panelRef.current?.contains(node)) return;
      setOpen(false);
      setSearch('');
      setRect(null);
    }
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  function elegir(presId: string) {
    onChange(presId);
    setOpen(false);
    setSearch('');
    setRect(null);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${triggerClassName} flex items-center justify-between gap-1 text-left ${
          !seleccionada ? 'text-vialto-steel' : ''
        }`}
      >
        <span className="truncate">{seleccionada ? seleccionada.nombre : sinValor}</span>
        <span className="shrink-0 text-[10px] text-vialto-steel" aria-hidden>
          ▼
        </span>
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              top: rect.top,
              left: rect.left,
              width: rect.width,
              zIndex: MENU_Z,
            }}
            className="rounded border border-black/15 bg-white shadow-lg text-sm flex flex-col max-h-72 overflow-hidden"
            role="dialog"
            aria-label="Seleccionar unidad de carga"
          >
            <div className="p-2 border-b border-black/10">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar unidad…"
                className="w-full h-8 px-2 border border-black/15 text-xs outline-none focus:border-vialto-fire"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false);
                    setSearch('');
                    setRect(null);
                  }
                }}
              />
            </div>
            <div className="overflow-y-auto flex-1 p-1">
              <button
                type="button"
                onClick={() => elegir('')}
                className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-vialto-mist ${
                  !value ? 'bg-vialto-mist font-medium' : 'text-vialto-steel'
                }`}
              >
                — Sin unidad —
              </button>
              {filtradas.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => elegir(o.id)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-vialto-mist ${
                    o.id === value ? 'bg-vialto-mist font-medium' : ''
                  }`}
                >
                  <span className="block truncate">{o.nombre}</span>
                </button>
              ))}
              {filtradas.length === 0 && (
                <p className="px-2 py-2 text-xs text-vialto-steel text-center">
                  No se encontraron unidades
                </p>
              )}
            </div>
            {onNuevaPresentacion && (
              <div className="p-1 border-t border-black/10 bg-vialto-mist/40">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setSearch('');
                    setRect(null);
                    onNuevaPresentacion();
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs text-vialto-fire hover:bg-white rounded font-medium transition-colors"
                >
                  + Crear unidad
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
