import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { AccionesMenuTrigger } from '@/components/ui/AccionesMenuTrigger';
import { AccionesOpcionesSheet, type AccionOpcion } from '@/components/ui/AccionesOpcionesSheet';

/** Máximo de acciones que se muestran como ícono directo en la fila. */
const MAX_ICONOS = 2;
const DROPDOWN_WIDTH_PX = 240;
const ID_ELIMINAR = 'eliminar';

type Props = {
  options: AccionOpcion[];
  /**
   * Ids de las acciones a mostrar como ícono, en orden de prioridad. Se muestran las
   * primeras {@link MAX_ICONOS} que estén disponibles en `options` para esa fila.
   * Las acciones `danger` no se listan acá; la única que puede ir como ícono es
   * "Eliminar" (id `eliminar`), y solo si sobra lugar.
   */
  destacadas: string[];
  /** Subtítulo del modal de acciones (ej. "Viaje #123"). */
  subtitle?: ReactNode;
  /** Modal de acciones (se abre al tocar la fila). Controlado por el padre si se pasan ambos. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Columna de acciones de un listado.
 * - Desktop: hasta 2 íconos con las acciones principales + flecha con desplegable de todas.
 * - Mobile: botón "Acciones" que abre el modal (sheet).
 * El modal con todas las acciones sigue disponible (click en la fila, vía `open`/`onOpenChange`).
 */
export function AccionesFila({ options, destacadas, subtitle, open: openProp, onOpenChange }: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlado = openProp !== undefined;
  const sheetOpen = controlado ? openProp : internalOpen;
  const setSheetOpen = controlado ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const iconos = destacadas
    .map((id) => options.find((o) => o.id === id))
    // Una acción `danger` solo va como ícono si la pantalla la lista explícitamente
    // en `destacadas` (ej. Anular en Liquidaciones).
    .filter((o): o is AccionOpcion => Boolean(o && o.icon))
    .slice(0, MAX_ICONOS);
  // "Eliminar" solo va como ícono si sobra lugar (igual pide confirmación al tocarlo).
  const eliminar = options.find((o) => o.id === ID_ELIMINAR && o.icon);
  if (eliminar && iconos.length < MAX_ICONOS && !iconos.includes(eliminar)) {
    iconos.push(eliminar);
  }
  // Las acciones peligrosas (Anular, Eliminar) nunca van primero: siempre al final.
  iconos.sort((a, b) => Number(Boolean(a.danger)) - Number(Boolean(b.danger)));

  return (
    <>
      <div className="hidden items-center justify-end gap-1 lg:inline-flex">
        {iconos.map((opt) => {
          const Icon = opt.icon!;
          const label = opt.description ? `${opt.label} — ${opt.description}` : opt.label;
          return (
            <button
              key={opt.id}
              type="button"
              title={label}
              aria-label={label}
              disabled={opt.disabled}
              onClick={(e) => {
                e.stopPropagation();
                if (!opt.disabled) opt.onClick();
              }}
              className={`inline-flex h-8 w-8 items-center justify-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                opt.danger
                  ? 'border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700'
                  : 'border-black/15 text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal'
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </button>
          );
        })}
        {/* Solo si queda alguna acción que no está como ícono. */}
        {options.length > iconos.length && <AccionesDropdown options={options} />}
      </div>

      <AccionesMenuTrigger
        open={sheetOpen}
        onClick={() => setSheetOpen(true)}
        className="lg:hidden"
      />

      <AccionesOpcionesSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        subtitle={subtitle}
        options={options}
      />
    </>
  );
}

/** Flecha + desplegable anclado con todas las acciones (portal + fixed, no lo recorta la tabla). */
function AccionesDropdown({ options }: { options: AccionOpcion[] }) {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!abierto) return;
    function ubicar() {
      const r = botonRef.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(8, Math.min(r.right - DROPDOWN_WIDTH_PX, window.innerWidth - DROPDOWN_WIDTH_PX - 8));
      const altoMenu = menuRef.current?.offsetHeight ?? 0;
      // Si no entra debajo, se abre hacia arriba.
      const top =
        altoMenu && r.bottom + 4 + altoMenu > window.innerHeight - 8
          ? Math.max(8, r.top - 4 - altoMenu)
          : r.bottom + 4;
      setPos({ top, left });
    }
    ubicar();
    // Segunda pasada con el alto real del menú ya montado.
    const raf = requestAnimationFrame(ubicar);
    window.addEventListener('resize', ubicar);
    window.addEventListener('scroll', ubicar, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', ubicar);
      window.removeEventListener('scroll', ubicar, true);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (botonRef.current?.contains(t) || menuRef.current?.contains(t)) return;
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

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        title="Más acciones"
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={(e) => {
          e.stopPropagation();
          setAbierto((v) => !v);
        }}
        className={`inline-flex h-8 w-6 items-center justify-center rounded border transition-colors hover:bg-vialto-mist hover:text-vialto-charcoal ${
          abierto ? 'border-vialto-charcoal/40 bg-vialto-mist text-vialto-charcoal' : 'border-black/15 text-vialto-steel'
        }`}
      >
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>
      {abierto
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-40 rounded-md border border-black/10 bg-white py-1 text-left shadow-lg"
              style={{
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                width: DROPDOWN_WIDTH_PX,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {options.map((opt, i) => {
                const Icon = opt.icon;
                const prevDanger = i > 0 && options[i - 1].danger;
                const separador = opt.separator || (opt.danger && !prevDanger);
                return (
                  <div key={opt.id}>
                    {separador && i > 0 && <div className="mx-2 my-1 border-t border-black/8" />}
                    <button
                      type="button"
                      role="menuitem"
                      disabled={opt.disabled}
                      onClick={() => {
                        if (opt.disabled) return;
                        setAbierto(false);
                        opt.onClick();
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        opt.danger ? 'text-red-700 hover:bg-red-50' : 'text-vialto-charcoal hover:bg-vialto-mist/70'
                      }`}
                    >
                      {Icon && <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />}
                      <span className="min-w-0">
                        <span className="block font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider">
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className="block text-xs leading-snug text-vialto-steel">
                            {opt.description}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
