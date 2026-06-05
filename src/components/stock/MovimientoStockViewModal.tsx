import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import {
  movimientoStockTipoBadgeClass,
  movimientoStockTipoLabel,
} from '@/lib/stockMovimientoTipo';
import type { MovimientoStock } from '@/types/api';
import { MovimientoStockDetalleBody } from './MovimientoStockDetalleBody';

function movimientoDetailUrl(id: string, tenantId?: string): string {
  if (tenantId?.trim()) {
    return `/api/platform/stock/movimientos/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId.trim())}`;
  }
  return `/api/stock/movimientos/${encodeURIComponent(id)}`;
}

export function MovimientoStockViewModal({
  movimientoId,
  tenantId,
  tipoTitulo,
  onClose,
}: {
  movimientoId: string;
  tenantId?: string;
  /** Mientras carga el detalle (p. ej. tipo del listado). */
  tipoTitulo?: MovimientoStock['tipo'];
  onClose: () => void;
}) {
  const { getToken } = useAuth();
  const [row, setRow] = useState<MovimientoStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await apiJson<MovimientoStock>(movimientoDetailUrl(movimientoId, tenantId), () => getToken());
        if (!cancelled) {
          setRow(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRow(null);
          setError(friendlyError(e, 'stock'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, movimientoId, tenantId]);

  const tipo = row?.tipo ?? tipoTitulo;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded border border-black/10 bg-white shadow-lg max-h-[90vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4 shrink-0">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">
              Movimiento de stock
            </h2>
            {tipo && (
              <p className="mt-1">
                <span className={movimientoStockTipoBadgeClass(tipo)}>
                  {movimientoStockTipoLabel(tipo)}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none shrink-0"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto min-h-0">
          {loading && (
            <p className="px-5 py-8 text-sm text-vialto-steel">Cargando detalle…</p>
          )}
          {error && (
            <p className="mx-5 my-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
          {!loading && row && (
            <MovimientoStockDetalleBody row={row} tenantId={tenantId} />
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-black/10 px-5 py-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
