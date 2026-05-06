import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OpcionCarga } from '@/lib/cargasOpciones';

function filaLabel(o: OpcionCarga) {
  return o.unidadMedida?.trim() ? `${o.nombre} · ${o.unidadMedida.trim()}` : o.nombre;
}

function etiquetaSeleccion(value: string, opciones: OpcionCarga[]) {
  if (!value.trim()) return '— Sin carga en catálogo —';
  const o = opciones.find((x) => x.id === value);
  return o ? filaLabel(o) : '— Sin carga en catálogo —';
}

export type TipoCargaSearchableSelectProps = {
  value: string;
  onChange: (cargaId: string) => void;
  opciones: OpcionCarga[];
  /** Clases del trigger (alineado a `select` / inputs de viaje). */
  triggerClassName: string;
  disabled?: boolean;
  /** id para accesibilidad */
  id?: string;
  /** Si está definido, al no haber coincidencias se ofrece abrir el alta con el texto buscado. */
  onSolicitarCrearNueva?: (sugerenciaNombre: string) => void;
};

/** Por encima del modal de edición de viaje (`z-[110]`). */
const MENU_Z = 300;

export function TipoCargaSearchableSelect({
  value,
  onChange,
  opciones,
  triggerClassName,
  disabled = false,
  id,
  onSolicitarCrearNueva,
}: TipoCargaSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) => {
      const n = o.nombre.toLowerCase();
      const u = (o.unidadMedida ?? '').toLowerCase();
      return n.includes(q) || u.includes(q);
    });
  }, [opciones, search]);

  const actualizarRect = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 220),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    actualizarRect();
  }, [open, actualizarRect]);

  useEffect(() => {
    if (!open) return;
    const onScrollResize = () => actualizarRect();
    window.addEventListener('resize', onScrollResize);
    window.addEventListener('scroll', onScrollResize, true);
    return () => {
      window.removeEventListener('resize', onScrollResize);
      window.removeEventListener('scroll', onScrollResize, true);
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

  const listId = id ? `${id}-listbox` : 'tipo-carga-listbox';
  const btnId = id ?? 'tipo-carga-combobox';

  const menu =
    open &&
    rect &&
    createPortal(
      <div
        ref={panelRef}
        id={listId}
        role="listbox"
        className="rounded border border-black/15 bg-white py-1 shadow-lg"
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          zIndex: MENU_Z,
        }}
      >
        <div className="border-b border-black/10 px-2 py-1.5">
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar carga por nombre o unidad…"
            className="h-8 w-full border border-black/15 bg-vialto-mist/40 px-2 text-sm outline-none focus:border-vialto-fire/40"
            aria-label="Buscar carga"
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
              onClick={() => {
                onChange('');
                setOpen(false);
                setSearch('');
                setRect(null);
              }}
            >
              — Sin carga en catálogo —
            </button>
          </li>
          {filtradas.length === 0 && search.trim() ? (
            <li role="none" className="px-1.5 pb-1.5 pt-0.5">
              <div className="rounded-md border border-dashed border-black/15 bg-gradient-to-b from-vialto-mist/70 to-white px-3 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]">
                <div className="flex gap-2.5">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-vialto-steel shadow-sm ring-1 ring-black/5"
                    aria-hidden
                  >
                    <svg
                      className="h-4 w-4 opacity-80"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-vialto-charcoal">
                      No hay cargas que coincidan
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-vialto-steel">
                      No encontramos «<span className="font-medium text-vialto-charcoal/90">{search.trim()}</span>»
                      en el catálogo.
                      {onSolicitarCrearNueva
                        ? ' Podés darlo de alta ahora y asignarlo a este viaje.'
                        : ' Si necesitás uno nuevo, pedilo a un administrador.'}
                    </p>
                  </div>
                </div>
                {onSolicitarCrearNueva ? (
                  <button
                    type="button"
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded border border-black/10 bg-vialto-charcoal px-3 py-2.5 text-left text-xs font-medium uppercase tracking-[0.12em] text-white shadow-sm transition-colors hover:bg-vialto-graphite focus:outline-none focus-visible:ring-2 focus-visible:ring-vialto-fire/50 focus-visible:ring-offset-2"
                    onClick={() => {
                      const s = search.trim();
                      setOpen(false);
                      setSearch('');
                      setRect(null);
                      onSolicitarCrearNueva(s);
                    }}
                  >
                    <svg
                      className="h-3.5 w-3.5 shrink-0 opacity-95"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.25}
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span className="truncate">Crear carga y usar en el viaje</span>
                  </button>
                ) : null}
              </div>
            </li>
          ) : (
            filtradas.map((o) => (
              <li key={o.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === o.id}
                  className={`flex w-full px-2 py-1.5 text-left text-sm hover:bg-vialto-mist/80 ${
                    value === o.id ? 'bg-vialto-mist/60 font-medium' : ''
                  }`}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setSearch('');
                    setRect(null);
                  }}
                >
                  {filaLabel(o)}
                </button>
              </li>
            ))
          )}
        </ul>
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
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
      >
        <span className="min-w-0 truncate">{etiquetaSeleccion(value, opciones)}</span>
        <span className="shrink-0 text-vialto-steel" aria-hidden>
          ▾
        </span>
      </button>
      {menu}
    </div>
  );
}
