import {
  LISTADO_PAGE_SIZE_OPTIONS,
  paginasVisibles,
} from "@/lib/listadoPaginacion";
import type { PaginatedMeta } from "@/types/api";

type Props = {
  meta: PaginatedMeta;
  pageSize: number;
  loading?: boolean;
  totalLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

const navBtnClass =
  "h-9 min-w-9 px-2 border border-black/20 text-xs uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-vialto-mist/80";

export function ListadoPagination({
  meta,
  pageSize,
  loading = false,
  totalLabel = "registros",
  onPageChange,
  onPageSizeChange,
}: Props) {
  const paginas = paginasVisibles(meta.page, meta.totalPages);
  const disabled = loading;

  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-vialto-steel">
          Página {meta.page} de {meta.totalPages} · {meta.total} {totalLabel}
        </p>
        <label className="text-xs uppercase tracking-wider text-vialto-steel flex items-center gap-2">
          Mostrar
          <select
            value={pageSize}
            disabled={disabled}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 border border-black/20 bg-white px-2 text-xs disabled:opacity-50"
            aria-label="Registros por página"
          >
            {LISTADO_PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="inline-flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={disabled || meta.page <= 1}
          onClick={() => onPageChange(1)}
          className={navBtnClass}
          aria-label="Primera página"
          title="Primera página"
        >
          {"<<"}
        </button>
        <button
          type="button"
          disabled={disabled || !meta.hasPrev}
          onClick={() => onPageChange(Math.max(1, meta.page - 1))}
          className={navBtnClass}
        >
          Anterior
        </button>

        {paginas.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onPageChange(p)}
            aria-current={p === meta.page ? "page" : undefined}
            className={`h-9 min-w-9 px-2 border text-xs tabular-nums disabled:opacity-40 ${
              p === meta.page
                ? "border-vialto-charcoal bg-vialto-charcoal text-white"
                : "border-black/20 text-vialto-charcoal hover:bg-vialto-mist/80"
            }`}
          >
            {p}
          </button>
        ))}

        <button
          type="button"
          disabled={disabled || !meta.hasNext}
          onClick={() => onPageChange(meta.page + 1)}
          className={navBtnClass}
        >
          Siguiente
        </button>
        <button
          type="button"
          disabled={disabled || meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.totalPages)}
          className={navBtnClass}
          aria-label="Última página"
          title="Última página"
        >
          {">>"}
        </button>
      </div>
    </div>
  );
}
