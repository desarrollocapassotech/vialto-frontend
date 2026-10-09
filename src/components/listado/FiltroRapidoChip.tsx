import { selectorTabClass } from "@/components/ui/SelectorOpcionesSheet";

type Props = {
  label: string;
  active: boolean;
  onClick: () => void;
  /** Cantidad de registros que trae el filtro. Sin dato o en 0 no se muestra. */
  count?: number;
};

const ACTIVE_CLASS =
  "rounded border border-vialto-fire bg-vialto-fire px-4 py-2 text-sm font-[family-name:var(--font-ui)] uppercase tracking-wider text-white transition-colors";

function formatCount(n: number) {
  return n > 999 ? "999+" : String(n);
}

/** Chip de filtro rápido (Viajes, Facturas, Liquidaciones), con la cantidad al lado. */
export function FiltroRapidoChip({ label, active, onClick, count }: Props) {
  const mostrarCount = typeof count === "number" && count > 0;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`shrink-0 ${active ? ACTIVE_CLASS : selectorTabClass(false)}`}
    >
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        {label}
        {mostrarCount && (
          <span
            className={[
              "inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded-full px-1.5 text-xs font-semibold normal-case tracking-normal tabular-nums leading-none",
              active
                ? "bg-white text-vialto-fire"
                : "bg-vialto-fire/10 text-vialto-fire ring-1 ring-inset ring-vialto-fire/25",
            ].join(" ")}
            aria-label={`${count} registros`}
          >
            {formatCount(count)}
          </span>
        )}
      </span>
    </button>
  );
}
