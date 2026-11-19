import { ChevronLeft, ChevronRight } from "lucide-react";
import { paginasVisibles } from "@/lib/listadoPaginacion";
import type { PaginaLocal } from "@/hooks/usePaginaLocal";

const botonClass =
  "inline-flex h-7 min-w-7 items-center justify-center border px-1.5 text-xs tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-30";

/**
 * Paginador chico para tablas del dashboard ("6–10 de 23  ‹ 1 2 3 ›"). Con una sola
 * página no se muestra. Va con `usePaginaLocal`.
 */
export function PaginacionCompacta({ paginacion }: { paginacion: PaginaLocal }) {
  const { pagina, totalPaginas, total, tamano, setPagina } = paginacion;
  if (totalPaginas <= 1) return null;
  const desde = (pagina - 1) * tamano + 1;
  const hasta = Math.min(total, pagina * tamano);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/5 pt-3 text-xs text-vialto-steel">
      <span className="tabular-nums">
        {desde}–{hasta} de {total}
      </span>
      <nav className="flex items-center gap-1" aria-label="Paginación">
        <button
          type="button"
          onClick={() => setPagina(pagina - 1)}
          disabled={pagina <= 1}
          aria-label="Página anterior"
          className={`${botonClass} border-black/10 bg-white text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal`}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        </button>
        {paginasVisibles(pagina, totalPaginas, 5).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPagina(n)}
            aria-current={n === pagina ? "page" : undefined}
            className={`${botonClass} ${
              n === pagina
                ? "border-vialto-charcoal bg-vialto-charcoal font-semibold text-white"
                : "border-black/10 bg-white text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPagina(pagina + 1)}
          disabled={pagina >= totalPaginas}
          aria-label="Página siguiente"
          className={`${botonClass} border-black/10 bg-white text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal`}
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </nav>
    </div>
  );
}
