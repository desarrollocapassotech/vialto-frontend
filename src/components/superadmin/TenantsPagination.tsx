import type { PaginatedMeta } from '@/types/api';

interface TenantsPaginationProps {
  meta: PaginatedMeta;
  loading: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onPrev: () => void;
  onNext: () => void;
}

export function TenantsPagination({
  meta,
  loading,
  pageSize,
  onPageSizeChange,
  onPrev,
  onNext,
}: TenantsPaginationProps) {
  const canPrev = !loading && meta.hasPrev;
  const canNext = !loading && meta.hasNext;

  return (
    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-vialto-steel">
        Página {meta.page} de {meta.totalPages} · {meta.total} empresas
      </p>
      <div className="flex items-center gap-2">
        <label className="text-xs uppercase tracking-wider text-vialto-steel">
          Filas
        </label>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="h-9 border border-black/15 bg-white px-2 text-sm"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
        <button
          type="button"
          disabled={!canPrev}
          onClick={onPrev}
          className="h-9 px-3 border border-black/15 bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={onNext}
          className="h-9 px-3 bg-vialto-charcoal text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
