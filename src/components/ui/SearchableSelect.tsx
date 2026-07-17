import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type SearchableSelectOption = { value: string; label: string };

export type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  /** Texto del botón y de la opción que limpia el filtro. */
  placeholder?: string;
  searchPlaceholder?: string;
  triggerClassName?: string;
  ariaLabel: string;
};

const MENU_Z = 300;

/**
 * Select con buscador (combobox) para filtros con muchas opciones —
 * conductor, vehículo, estación, etc. `value: ""` equivale a "sin filtro".
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Todas",
  searchPlaceholder = "Buscar…",
  triggerClassName = "",
  ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

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
    window.addEventListener("resize", fn);
    window.addEventListener("scroll", fn, true);
    return () => {
      window.removeEventListener("resize", fn);
      window.removeEventListener("scroll", fn, true);
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
      if (btnRef.current?.contains(node) || panelRef.current?.contains(node))
        return;
      setOpen(false);
      setSearch("");
      setRect(null);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setSearch("");
        setRect(null);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  function elegir(v: string) {
    onChange(v);
    setOpen(false);
    setSearch("");
    setRect(null);
  }

  const etiquetaSeleccion =
    options.find((o) => o.value === value)?.label ?? placeholder;

  const menu =
    open &&
    rect &&
    createPortal(
      <div
        ref={panelRef}
        role="listbox"
        className="rounded border border-black/15 bg-white py-1 shadow-lg"
        style={{
          position: "fixed",
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
            placeholder={searchPlaceholder}
            className="h-8 w-full border border-black/15 bg-vialto-mist/40 px-2 text-sm outline-none focus:border-vialto-fire/40"
            aria-label={searchPlaceholder}
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
              onClick={() => elegir("")}
            >
              {placeholder}
            </button>
          </li>
          {filtradas.length === 0 && search.trim() ? (
            <li role="none" className="px-2 py-2 text-xs text-vialto-steel">
              No hay resultados.
            </li>
          ) : (
            filtradas.map((o) => (
              <li key={o.value} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  className={`flex w-full px-2 py-1.5 text-left text-sm hover:bg-vialto-mist/80 ${
                    value === o.value ? "bg-vialto-mist/60 font-medium" : ""
                  }`}
                  onClick={() => elegir(o.value)}
                >
                  {o.label}
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
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`flex h-9 w-full min-w-0 items-center justify-between gap-2 border border-black/15 bg-white px-2 text-left text-sm ${triggerClassName}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 truncate">{etiquetaSeleccion}</span>
        <span className="shrink-0 text-vialto-steel" aria-hidden>
          ▾
        </span>
      </button>
      {menu}
    </div>
  );
}
