import { useEffect, useRef, useState, type ReactNode } from 'react';

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
  /** Ancho mínimo del encabezado (clase Tailwind). Default: `min-w-[9rem]`, pensado para
   * los controles de filtro (selects/search). Columnas angostas por contenido (ej. Etapa,
   * con badges cortos) pueden pasar un valor menor o `min-w-0` para no imponer un piso. */
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
  minWidthClass = "min-w-[9rem]",
  titleNoWrap = false,
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

  const mostrarContador = filterActive && !abierto;

  return (
    <div
      className={`flex flex-col gap-1.5 ${alignRight ? 'w-full items-end' : minWidthClass}`}
    >
      <div className="flex items-start gap-2">
        <div className="relative inline-flex shrink-0">
          <button
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
          className={`text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase ${
            titleNoWrap ? 'whitespace-nowrap' : ''
          } ${alignRight ? 'shrink-0' : 'min-w-0 flex-1'}`}
        >
          {title}
        </span>
      </div>
      {abierto ? (
        <div
          className={`normal-case text-sm tracking-normal ${alignRight ? 'min-w-[9rem]' : ''}`}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
