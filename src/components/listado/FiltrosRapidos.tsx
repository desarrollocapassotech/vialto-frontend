import { useRef, useState } from "react";
import { Filter } from "lucide-react";
import { FiltroRapidoChip } from "@/components/listado/FiltroRapidoChip";
import { TooltipsDelegados } from "@/components/ui/TooltipsDelegados";

export type FiltroRapidoOpcion<T extends string> = {
  id: T;
  label: string;
  /** Cantidad de registros que trae el filtro (se muestra al lado del label). */
  count?: number;
};

type BotonProps = {
  abierto: boolean;
  onToggle: () => void;
  /** Cantidad de filtros rápidos activos (badge naranja). */
  cantidadActivos: number;
  /**
   * Filtros que marcan algo pendiente, con su contador. Si alguno es > 0 y los chips están
   * cerrados, el embudo palpita; el tooltip los lista ("Sin facturar: 3").
   */
  pendientes: { label: string; count?: number }[];
};

/**
 * Embudo al lado del título que abre/cierra los filtros rápidos (Viajes, Facturas,
 * Liquidaciones). Palpita si hay pendientes y muestra el tooltip oscuro de la app.
 */
export function FiltrosRapidosBoton({
  abierto,
  onToggle,
  cantidadActivos,
  pendientes,
}: BotonProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const conCount = pendientes.filter((p) => (p.count ?? 0) > 0);
  const palpita = !abierto && conCount.length > 0;
  const tooltip = ["Filtros rápidos", ...conCount.map((p) => `${p.label}: ${p.count}`)].join(
    "\n",
  );

  return (
    <span ref={ref} className="inline-flex shrink-0">
      <TooltipsDelegados contenedorRef={ref} />
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={abierto}
        title={tooltip}
        aria-label={palpita ? "Mostrar filtros rápidos (hay pendientes)" : "Mostrar filtros rápidos"}
        className={`relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-vialto-mist hover:text-vialto-charcoal ${
          abierto
            ? "bg-vialto-mist text-vialto-charcoal"
            : palpita
              ? "text-vialto-fire"
              : "text-vialto-steel"
        }`}
      >
        {palpita && (
          <span
            className="pointer-events-none absolute inset-0 animate-ping rounded-md bg-vialto-fire/20 motion-reduce:hidden"
            aria-hidden
          />
        )}
        <Filter className="h-4 w-4" aria-hidden />
        {cantidadActivos > 0 && (
          <span
            className="absolute -right-1 -top-1 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-vialto-fire px-1 font-[family-name:var(--font-ui)] text-[10px] font-semibold tabular-nums leading-none text-white"
            aria-hidden
          >
            {cantidadActivos}
          </span>
        )}
      </button>
    </span>
  );
}

type Props<T extends string> = {
  opciones: FiltroRapidoOpcion<T>[];
  /** Opción activa; "" = ninguna. Las opciones son excluyentes entre sí. */
  value: T | "";
  onChange: (value: T | "") => void;
  ariaLabel: string;
};

/**
 * Ícono de filtro al lado del título que despliega chips de filtro rápido
 * (mismo aspecto que los de Viajes). Tocar el chip activo lo desactiva.
 * Todas las opciones cuentan como pendientes (Sin cobrar, Vencidas, Pendientes de anular).
 */
export function FiltrosRapidos<T extends string>({
  opciones,
  value,
  onChange,
  ariaLabel,
}: Props<T>) {
  const [abierto, setAbierto] = useState(value !== "");
  // Si el filtro se activa desde afuera (ej. un link con ?estado=), mostrar los chips.
  const [valorPrevio, setValorPrevio] = useState(value);
  if (value !== valorPrevio) {
    setValorPrevio(value);
    if (value !== "") setAbierto(true);
  }

  return (
    <>
      <FiltrosRapidosBoton
        abierto={abierto}
        onToggle={() => setAbierto((v) => !v)}
        cantidadActivos={value !== "" ? 1 : 0}
        pendientes={opciones}
      />

      {abierto && (
        <div
          className="flex min-w-0 gap-2 overflow-x-auto pb-0.5 lg:flex-wrap lg:pb-0"
          role="tablist"
          aria-label={ariaLabel}
        >
          {opciones.map((o) => {
            const active = value === o.id;
            return (
              <FiltroRapidoChip
                key={o.id}
                label={o.label}
                active={active}
                count={o.count}
                onClick={() => onChange(active ? "" : o.id)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
