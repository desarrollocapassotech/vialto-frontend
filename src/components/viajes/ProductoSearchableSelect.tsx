import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OpcionProducto } from '@/lib/productosViaje';

function filaLabel(o: OpcionProducto) {
  return o.nombre;
}

function etiquetaSeleccion(value: string, opciones: OpcionProducto[]) {
  if (!value.trim()) return '— Sin producto —';
  const o = opciones.find((x) => x.id === value);
  return o ? filaLabel(o) : '— Sin producto —';
}

export type ProductoSearchableSelectProps = {
  value: string;
  onChange: (productoId: string) => void;
  opciones: OpcionProducto[];
  triggerClassName: string;
  disabled?: boolean;
  id?: string;
  onNuevoProducto?: () => void;
};

const MENU_Z = 300;

export function ProductoSearchableSelect({
  value,
  onChange,
  opciones,
  triggerClassName,
  disabled = false,
  id,
  onNuevoProducto,
}: ProductoSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [opciones, search]);

  const actualizarRect = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
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

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setSearch('');
        setRect(null);
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const listId = id ? `${id}-listbox` : 'producto-listbox';
  const btnId = id ?? 'producto-combobox';

  const menu =
    open &&
    rect &&
    createPortal(
      <div
        ref={panelRef}
        id={listId}
        role="listbox"
        className="rounded border border-black/15 bg-white py-1 shadow-lg"
        style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, zIndex: MENU_Z }}
      >
        <div className="border-b border-black/10 px-2 py-1.5">
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="h-8 w-full border border-black/15 bg-vialto-mist/40 px-2 text-sm outline-none focus:border-vialto-fire/40"
            aria-label="Buscar producto"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
        <ul className="max-h-52 overflow-y-auto py-0.5">
          <li role="none">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className="flex w-full px-2 py-1.5 text-left text-sm hover:bg-vialto-mist/80"
              onClick={() => { onChange(''); setOpen(false); setSearch(''); setRect(null); }}
            >
              — Sin producto —
            </button>
          </li>
          {filtradas.length === 0 && search.trim() ? (
            <li role="none" className="px-2 py-2 text-xs text-vialto-steel">
              No hay productos que coincidan.
            </li>
          ) : (
            filtradas.map((o) => (
              <li key={o.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === o.id}
                  className={`flex w-full px-2 py-1.5 text-left text-sm hover:bg-vialto-mist/80 ${value === o.id ? 'bg-vialto-mist/60 font-medium' : ''}`}
                  onClick={() => { onChange(o.id); setOpen(false); setSearch(''); setRect(null); }}
                >
                  {filaLabel(o)}
                </button>
              </li>
            ))
          )}
        </ul>
        {onNuevoProducto && (
          <div className="border-t border-black/10 px-2 py-2">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1 border border-black/20 bg-vialto-mist/60 px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
              onClick={() => { setOpen(false); setSearch(''); setRect(null); onNuevoProducto(); }}
            >
              + Nuevo producto
            </button>
          </div>
        )}
      </div>,
      document.body,
    );

  return (
    <div className="relative min-w-0">
      <button
        ref={btnRef}
        id={btnId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={`flex h-9 w-full min-w-0 items-center justify-between gap-2 border border-black/15 bg-white px-2 text-left text-sm disabled:opacity-50 ${triggerClassName}`}
        onClick={() => { if (disabled) return; setOpen((v) => !v); }}
      >
        <span className="min-w-0 truncate">{etiquetaSeleccion(value, opciones)}</span>
        <span className="shrink-0 text-vialto-steel" aria-hidden>▾</span>
      </button>
      {menu}
    </div>
  );
}
