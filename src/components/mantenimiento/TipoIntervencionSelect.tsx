import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  fmtTipoIntervencion,
  TIPO_INTERVENCION_CATEGORIAS,
  TIPO_INTERVENCION_OTRO,
} from "@/lib/mantenimientoLabels";
import type { TipoIntervencionMantenimiento } from "@/types/api";

const GRUPOS = [
  ...TIPO_INTERVENCION_CATEGORIAS,
  { id: "otro" as const, label: "Otro", opciones: [TIPO_INTERVENCION_OTRO] },
];

const PANEL_MAX_H = 288; // max-h-72
const GAP = 4;

export function TipoIntervencionSelect({
  value,
  onChange,
  error,
}: {
  value: TipoIntervencionMantenimiento[];
  onChange: (next: TipoIntervencionMantenimiento[]) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  function updateMenuPosition() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - GAP;
    const spaceAbove = r.top - GAP;
    const base: CSSProperties = {
      position: "fixed",
      left: r.left,
      width: Math.max(r.width, 260),
      zIndex: 9999,
    };
    if (spaceBelow >= PANEL_MAX_H || spaceBelow >= spaceAbove) {
      setMenuStyle({ ...base, top: r.bottom + GAP });
    } else {
      setMenuStyle({ ...base, bottom: window.innerHeight - r.top + GAP });
    }
  }

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onScrollResize() {
      updateMenuPosition();
    }
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const q = query.trim().toLowerCase();
  const gruposFiltrados = useMemo(() => {
    if (!q) return GRUPOS;
    return GRUPOS.map((g) => ({
      ...g,
      opciones: g.opciones.filter(([, label]) =>
        label.toLowerCase().includes(q),
      ),
    })).filter((g) => g.opciones.length > 0);
  }, [q]);

  function toggle(v: TipoIntervencionMantenimiento) {
    onChange(
      value.includes(v) ? value.filter((x) => x !== v) : [...value, v],
    );
  }

  const panelEl =
    open && menuStyle ? (
      <div
        ref={panelRef}
        style={menuStyle}
        className="flex max-h-72 flex-col overflow-hidden border border-black/15 bg-white shadow-md"
      >
        <div className="shrink-0 border-b border-black/10 p-2">
          <input
            ref={searchRef}
            type="text"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tipo…"
            className="h-9 w-full border border-black/15 px-2 text-sm outline-none focus:border-black/25"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {gruposFiltrados.length === 0 ? (
            <p className="px-3 py-3 text-sm text-vialto-steel">
              Sin coincidencias.
            </p>
          ) : (
            gruposFiltrados.map((g) => (
              <div key={g.id}>
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-vialto-steel/80">
                  {g.label}
                </p>
                {g.opciones.map(([v, label]) => {
                  const checked = value.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        toggle(v);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-vialto-mist ${
                        checked ? "font-medium text-vialto-fire" : ""
                      }`}
                    >
                      {label}
                      {checked && <span aria-hidden>✓</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    ) : null;

  return (
    <div ref={wrapRef} className="flex flex-col gap-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 border border-vialto-fire/40 bg-vialto-fire/10 px-2 py-1 text-xs text-vialto-charcoal"
            >
              {fmtTipoIntervencion(v)}
              <button
                type="button"
                onClick={() => toggle(v)}
                aria-label={`Quitar ${fmtTipoIntervencion(v)}`}
                className="text-vialto-steel hover:text-vialto-charcoal"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`h-9 w-full border bg-white px-2 text-left text-sm text-vialto-steel hover:bg-vialto-mist ${
          error ? "border-red-400" : "border-black/15"
        }`}
      >
        {value.length === 0 ? "Agregar tipo…" : "+ Agregar otro tipo…"}
      </button>

      {typeof document !== "undefined" && panelEl
        ? createPortal(panelEl, document.body)
        : null}
    </div>
  );
}
