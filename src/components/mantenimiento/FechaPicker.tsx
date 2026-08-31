import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const GAP = 4;

type FechaYMD = { y: number; m: number; d: number };

function parseIso(value: string): FechaYMD | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toIso({ y, m, d }: FechaYMD): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function hoyYMD(): FechaYMD {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
}

function esMismoDia(a: FechaYMD, b: FechaYMD): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

function fmtLabel(value: string): string {
  const p = parseIso(value);
  if (!p) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(p.y, p.m - 1, p.d)));
}

function fmtMesAnio(y: number, m: number): string {
  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Grilla de 42 días (6 semanas), semana arrancando en lunes. */
function buildDias(viewYear: number, viewMonth: number): FechaYMD[] {
  const primerDiaMes = new Date(viewYear, viewMonth - 1, 1);
  const offset = (primerDiaMes.getDay() + 6) % 7;
  const inicio = new Date(viewYear, viewMonth - 1, 1 - offset);
  const dias: FechaYMD[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    dias.push({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
  }
  return dias;
}

export function FechaPicker({
  value,
  onChange,
  placeholder = "Seleccioná una fecha…",
  error,
  allowClear = false,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  error?: string;
  /** Muestra el botón "Limpiar" en el panel (campos opcionales). */
  allowClear?: boolean;
  "aria-label"?: string;
}) {
  const seleccionado = parseIso(value);
  const hoy = hoyYMD();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ y: number; m: number }>(() => ({
    y: seleccionado?.y ?? hoy.y,
    m: seleccionado?.m ?? hoy.m,
  }));
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function updateMenuPosition() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const PANEL_H = 340;
    const spaceBelow = window.innerHeight - r.bottom - GAP;
    const spaceAbove = r.top - GAP;
    const base: CSSProperties = {
      position: "fixed",
      left: r.left,
      width: Math.max(r.width, 280),
      zIndex: 9999,
    };
    if (spaceBelow >= PANEL_H || spaceBelow >= spaceAbove) {
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
    setView({ y: seleccionado?.y ?? hoy.y, m: seleccionado?.m ?? hoy.m });
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

  const dias = useMemo(() => buildDias(view.y, view.m), [view.y, view.m]);

  function irMesAnterior() {
    setView((v) => (v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 }));
  }

  function irMesSiguiente() {
    setView((v) => (v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 }));
  }

  function elegirDia(f: FechaYMD) {
    onChange(toIso(f));
    setOpen(false);
  }

  const panelEl =
    open && menuStyle ? (
      <div
        ref={panelRef}
        style={menuStyle}
        className="flex flex-col border border-black/15 bg-white p-3 shadow-md"
      >
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={irMesAnterior}
            aria-label="Mes anterior"
            className="flex h-9 w-9 items-center justify-center text-vialto-steel hover:bg-vialto-mist"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <span className="text-sm font-medium text-vialto-charcoal">
            {fmtMesAnio(view.y, view.m)}
          </span>
          <button
            type="button"
            onClick={irMesSiguiente}
            aria-label="Mes siguiente"
            className="flex h-9 w-9 items-center justify-center text-vialto-steel hover:bg-vialto-mist"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d}
              className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase tracking-wider text-vialto-steel/70"
            >
              {d}
            </div>
          ))}
          {dias.map((f, i) => {
            const delMesActual = f.m === view.m && f.y === view.y;
            const esSeleccionado = seleccionado
              ? esMismoDia(f, seleccionado)
              : false;
            const esHoy = esMismoDia(f, hoy);
            return (
              <button
                key={i}
                type="button"
                onClick={() => elegirDia(f)}
                className={`flex h-9 w-9 items-center justify-center text-sm sm:h-8 sm:w-8 sm:text-xs ${
                  esSeleccionado
                    ? "bg-vialto-fire text-white"
                    : delMesActual
                      ? "text-vialto-charcoal hover:bg-vialto-mist"
                      : "text-vialto-steel/40 hover:bg-vialto-mist"
                } ${esHoy && !esSeleccionado ? "border border-vialto-fire" : ""}`}
              >
                {f.d}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-black/10 pt-2">
          <button
            type="button"
            onClick={() => elegirDia(hoy)}
            className="text-xs font-medium uppercase tracking-wider text-vialto-fire hover:underline"
          >
            Hoy
          </button>
          {allowClear && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-xs font-medium uppercase tracking-wider text-vialto-steel hover:underline"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>
    ) : null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`flex h-11 w-full items-center justify-between gap-2 border bg-white px-3 text-left text-base text-vialto-charcoal hover:bg-vialto-mist sm:h-9 sm:px-2 sm:text-sm ${
          error ? "border-red-400" : "border-black/15"
        }`}
      >
        <span className={value ? "" : "text-vialto-steel"}>
          {value ? fmtLabel(value) : placeholder}
        </span>
        <Calendar
          className="h-4 w-4 shrink-0 text-vialto-steel"
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      {typeof document !== "undefined" && panelEl
        ? createPortal(panelEl, document.body)
        : null}
    </div>
  );
}
