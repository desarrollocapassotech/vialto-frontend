import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
} from '@/components/ui/ViewModalShell';
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
    <ViewModalShell
      title={
        <span className="flex flex-col items-start gap-1">
          <span>Movimiento de stock</span>
          {tipo && (
            <span className={movimientoStockTipoBadgeClass(tipo)}>
              {movimientoStockTipoLabel(tipo)}
            </span>
          )}
        </span>
      }
      onClose={onClose}
      onOverlayClick={onClose}
      scrollBody
      footer={
        <button type="button" onClick={onClose} className={viewModalBtnGhost}>
          Cerrar
        </button>
      }
    >
      {loading && (
        <p className="text-sm text-vialto-steel">Cargando detalle…</p>
      )}
      {error && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {!loading && row && (
        <MovimientoStockDetalleBody row={row} tenantId={tenantId} />
      )}
    </ViewModalShell>
  );
}
