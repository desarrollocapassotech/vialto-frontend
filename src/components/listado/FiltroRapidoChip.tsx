import { ChevronDown, Filter, type LucideIcon } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { TooltipsDelegados } from "@/components/ui/TooltipsDelegados";

type Props = {
  label: string;
  /** Ícono del filtro (lucide), a la izquierda del texto. */
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
  /** Cantidad de registros que trae el filtro. 0 = "0" verde y el chip no se aplica. */
  count?: number;
  /** Se están contando los registros: el chip no se aplica hasta saber si hay. */
  cargando?: boolean;
  /** Abre un menú de opciones (ej. período): muestra una flecha y `aria-haspopup`. */
  desplegable?: { abierto: boolean };
};

function formatCount(n: number) {
  return n > 999 ? "999+" : String(n);
}

/** Embudo tenue al principio de la cápsula (igual que el filtro de período del dashboard). */
export function FiltrosRapidosIcono() {
  return (
    <span className="flex shrink-0 items-center pl-2 pr-0.5 text-vialto-steel/35" title="Filtros rápidos" aria-hidden>
      <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
    </span>
  );
}

/**
 * Cápsula blanca, siempre visible, que agrupa los chips de filtro rápido, con el mismo
 * estilo que el filtro de período del dashboard (`DashboardPeriodoSelector`): borde
 * suave, esquinas redondeadas, sombra leve, el embudo tenue adentro y los chips como un
 * control segmentado.
 */
export function FiltrosRapidosGrupo({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  // Tooltip oscuro de la app para los `title` de adentro (ej. "No hay registros…").
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-black/10 bg-white p-1 shadow-sm"
    >
      <TooltipsDelegados contenedorRef={ref} />
      <FiltrosRapidosIcono />
      <div role="tablist" aria-label={ariaLabel} className="flex gap-1">
        {children}
      </div>
    </div>
  );
}

/**
 * Chip de filtro rápido (Viajes, Facturas, Liquidaciones, Cuenta corriente…), con la
 * cantidad al lado. Va dentro de `FiltrosRapidosGrupo`. Mismo estilo que las opciones
 * del filtro de período del dashboard: activo oscuro, el resto gris que se marca al pasar.
 */
export function FiltroRapidoChip({
  label,
  icon: Icon,
  active,
  onClick,
  count,
  cargando = false,
  desplegable,
}: Props) {
  const contando = cargando && !desplegable;
  const mostrarCount = !contando && typeof count === "number" && count > 0;
  // Sin registros: "0" verde (todo en orden) y el chip no se puede aplicar. Mientras se
  // cuenta, tampoco. Si ya estaba aplicado se deja tocar, para poder quitarlo. Los
  // desplegables (ej. período) no se bloquean: el 0 es de una opción, no de todas.
  const sinRegistros = !contando && count === 0;
  const deshabilitado = (sinRegistros || contando) && !active && !desplegable;
  const tooltip = contando
    ? "Contando registros…"
    : sinRegistros && !active && !desplegable
      ? `No hay registros "${label}"`
      : undefined;
  return (
    <button
      type="button"
      role={desplegable ? undefined : "tab"}
      aria-selected={desplegable ? undefined : active}
      aria-haspopup={desplegable ? "menu" : undefined}
      aria-expanded={desplegable?.abierto}
      // Sin `disabled`: un botón deshabilitado no muestra tooltip. Se bloquea el click a mano.
      onClick={deshabilitado ? undefined : onClick}
      aria-disabled={deshabilitado || undefined}
      // `data-tooltip` (no `title`): lo controla React, así se actualiza o se borra cuando
      // termina de contar. Con `title`, el tooltip oscuro lo mueve y quedaba el texto viejo.
      data-tooltip={tooltip}
      className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-vialto-charcoal text-white shadow-sm"
          : deshabilitado
            ? "cursor-not-allowed text-vialto-steel opacity-60"
            : "text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal"
      }`}
    >
      {Icon && (
        <Icon
          className={`h-4 w-4 shrink-0 ${active ? "text-vialto-fire" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
      )}
      {label}
      {mostrarCount && (
        <span
          className={`inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums leading-none ${
            active ? "bg-vialto-fire text-white" : "bg-vialto-fire/10 text-vialto-fire"
          }`}
          aria-label={`${count} registros`}
        >
          {formatCount(count)}
        </span>
      )}
      {contando && (
        <span className="inline-block h-5 w-6 animate-pulse rounded-full bg-black/[0.07]" aria-label="Contando registros" />
      )}
      {sinRegistros && (
        <span
          className={`inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums leading-none ${
            active ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600"
          }`}
          aria-label="Sin registros"
        >
          0
        </span>
      )}
      {desplegable && (
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${desplegable.abierto ? "rotate-180" : ""}`}
          aria-hidden
        />
      )}
    </button>
  );
}
