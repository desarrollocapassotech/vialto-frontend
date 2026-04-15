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
    <div className="flex min-w-[9rem] flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 text-[15px] leading-tight tracking-[0.2em] text-vialto-fire uppercase">
          {title}
        </span>
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
      </div>
      {abierto ? (
        <div
          className="normal-case text-sm tracking-normal"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
