import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Ancho del panel flotante de filtro (px). */
const PANEL_WIDTH_PX = 288;

type Props = {
  /** Título visible de la columna (mayúsculas, estilo listado). */
  title: string;
  /** Controles de filtro (dropdowns); solo se montan al abrir el panel. */
  children: ReactNode;
  /** Hay al menos un criterio aplicado en esta columna (resalta el icono y muestra «1» si el panel está cerrado). */
  filterActive: boolean;
  /**
   * Cadena que cambia cuando cambia el criterio aplicado (ej. id de cliente).
   * Si el panel está abierto y la firma cambia **con filtro ya aplicado** (`filterActive`), o si el filtro pasa a aplicado en ese cambio, se cierra el panel.
   * Así no se cierra al elegir solo el tipo (p. ej. Origen) antes de ciudad/fechas.
   */
  filterSignature?: string;
  /** Alinea título + icono al borde derecho de la celda (columnas numéricas). */
  alignRight?: boolean;
  /** Ancho mínimo del encabezado (clase Tailwind). Default: `min-w-0` — los controles de
   * filtro abren en un panel flotante, así que el encabezado no necesita reservarles lugar. */
  minWidthClass?: string;
  /**
   * true = el título nunca se parte en dos líneas (la columna se angosta como mucho hasta
   * el ancho del título/contenido en una sola línea). Default false: el título puede saltar
   * de línea si la columna se angosta (ok para columnas con contenido largo debajo, como
   * "Origen — Destino" o "Carga — Descarga", donde no tiene sentido forzar el ancho del
   * header). Usar junto con `minWidthClass="min-w-0"` en columnas de contenido corto (ej. ID,
   * ID propio, Etapa) para que la columna se achique al mínimo posible sin cortar texto.
   */
  titleNoWrap?: boolean;
  /** Si se pasa y hay filtro aplicado, muestra una ✕ en el encabezado que lo quita. */
  onClear?: () => void;
};

function IconoFiltro({ marcado }: { marcado: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`h-4 w-4 ${marcado ? 'text-vialto-fire' : 'text-vialto-steel'}`}
      aria-hidden
    >
      <path d="M4.25 5.61C6.27 8.2 10 13 10 13v5c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-5s3.72-4.8 5.74-7.39c.51-.67.04-1.61-.8-1.61H5.04c-.84 0-1.31.94-.79 1.61z" />
    </svg>
  );
}

/**
 * Encabezado de columna con filtro colapsado: título + icono; al abrir, los mismos controles que antes.
 * Con filtro aplicado y panel cerrado, muestra «1» sobre el icono.
 * El panel se colapsa al aplicar el filtro o al cambiarlo mientras ya está aplicado (ver `filterSignature`).
 */
export function ViajesListadoHeaderFiltro({
  title,
  children,
  filterActive,
  filterSignature,
  alignRight = false,
  minWidthClass = "min-w-0",
  titleNoWrap = false,
  onClear,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const iconoMarcado = filterActive || abierto;
  const firmaPrev = useRef<string | null>(null);
  const filterActivePrev = useRef(filterActive);

  useEffect(() => {
    if (filterSignature === undefined) {
      filterActivePrev.current = filterActive;
      return;
    }
    if (firmaPrev.current === null) {
      firmaPrev.current = filterSignature;
      filterActivePrev.current = filterActive;
      return;
    }
    const sigChanged = firmaPrev.current !== filterSignature;
    const becameActive = !filterActivePrev.current && filterActive;

    if (sigChanged) {
      firmaPrev.current = filterSignature;
    }
    filterActivePrev.current = filterActive;

    if (sigChanged && (becameActive || filterActive)) {
      setAbierto(false);
    }
  }, [filterSignature, filterActive]);

  // Panel flotante (portal + fixed): no ensancha la columna ni queda recortado por el
  // overflow del wrapper de la tabla.
  const botonRef = useRef<HTMLButtonElement>(null);
  const clickDentroRef = useRef(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!abierto) return;
    function ubicar() {
      const r = botonRef.current?.getBoundingClientRect();
      if (!r) return;
      const anchoPanel = PANEL_WIDTH_PX;
      const izquierdaDeseada = alignRight ? r.right - anchoPanel : r.left;
      const left = Math.max(8, Math.min(izquierdaDeseada, window.innerWidth - anchoPanel - 8));
      setPos({ top: r.bottom + 6, left });
    }
    ubicar();
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => {
      window.removeEventListener('resize', ubicar);
      window.removeEventListener('scroll', ubicar, true);
    };
  }, [abierto, alignRight]);

  useEffect(() => {
    if (!abierto) return;
    // Los selects del panel abren sus listas en otro portal: el "adentro" se detecta por el
    // árbol de React (onMouseDownCapture del panel), no por el DOM.
    function onMouseDown(e: MouseEvent) {
      if (clickDentroRef.current) {
        clickDentroRef.current = false;
        return;
      }
      if (botonRef.current?.contains(e.target as Node)) return;
      setAbierto(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [abierto]);

  const mostrarContador = filterActive && !abierto;

  return (
    <div
      className={`flex ${alignRight ? 'w-full justify-end' : minWidthClass}`}
    >
      <div className="flex items-center gap-1.5">
        <div className="relative inline-flex shrink-0">
          <button
            ref={botonRef}
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className={`relative rounded border p-1 transition-colors ${
              abierto
                ? 'border-vialto-fire bg-white shadow-sm'
                : 'border-black/10 bg-white hover:bg-vialto-mist/80'
            }`}
            aria-expanded={abierto}
            aria-label={`Mostrar u ocultar filtro: ${title}`}
          >
            <IconoFiltro marcado={iconoMarcado} />
          </button>
          {mostrarContador ? (
            <span
              className="pointer-events-none absolute -right-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-vialto-fire font-[family-name:var(--font-ui)] text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-white"
              aria-hidden
            >
              <span className="translate-x-[1.5px] leading-none">1</span>
            </span>
          ) : null}
        </div>
        <span
          className={`leading-tight uppercase ${
            titleNoWrap ? 'whitespace-nowrap' : ''
          } ${alignRight ? 'shrink-0' : 'min-w-0 flex-1'}`}
        >
          {title}
        </span>
        {filterActive && onClear ? (
          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              onClear();
            }}
            className="shrink-0 rounded p-0.5 text-vialto-steel transition-colors hover:bg-vialto-mist hover:text-vialto-fire"
            aria-label={`Quitar filtro: ${title}`}
            title="Quitar filtro"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              className="h-3.5 w-3.5"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>
      {abierto && pos
        ? createPortal(
            <div
              role="dialog"
              aria-label={`Filtro: ${title}`}
              className="fixed z-40 rounded border border-black/10 bg-white p-3 text-left font-[family-name:var(--font-body)] text-sm normal-case tracking-normal text-vialto-charcoal shadow-lg"
              style={{ top: pos.top, left: pos.left, width: PANEL_WIDTH_PX }}
              onMouseDownCapture={() => {
                clickDentroRef.current = true;
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
