import { useState } from "react";
import { Filter } from "lucide-react";
import { selectorTabClass } from "@/components/ui/SelectorOpcionesSheet";

export type FiltroRapidoOpcion<T extends string> = {
  id: T;
  label: string;
};

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
 */
export function FiltrosRapidos<T extends string>({
  opciones,
  value,
  onChange,
  ariaLabel,
}: Props<T>) {
  const [abierto, setAbierto] = useState(value !== "");

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-label="Mostrar filtros rápidos"
        className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-vialto-steel transition-colors hover:bg-vialto-mist hover:text-vialto-charcoal ${
          abierto ? "bg-vialto-mist text-vialto-charcoal" : ""
        }`}
      >
        <Filter className="h-4 w-4" aria-hidden />
        {value !== "" && (
          <span
            className="absolute -right-1 -top-1 inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-vialto-fire px-1 font-[family-name:var(--font-ui)] text-[10px] font-semibold tabular-nums leading-none text-white"
            aria-hidden
          >
            1
          </span>
        )}
      </button>

      {abierto && (
        <div
          className="flex min-w-0 gap-2 overflow-x-auto pb-0.5 lg:flex-wrap lg:pb-0"
          role="tablist"
          aria-label={ariaLabel}
        >
          {opciones.map((o) => {
            const active = value === o.id;
            return (
              <button
                key={o.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(active ? "" : o.id)}
                className={
                  active
                    ? "rounded border border-vialto-fire bg-vialto-fire px-4 py-2 text-sm font-[family-name:var(--font-ui)] uppercase tracking-wider text-white transition-colors"
                    : selectorTabClass(false)
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
