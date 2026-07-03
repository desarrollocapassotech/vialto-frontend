import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from '@/components/ui/ViewModalShell';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { DireccionEntrega } from '@/types/api';

function direccionEntregaDetailUrl(id: string, tenantId?: string): string {
  if (tenantId?.trim()) {
    return `/api/platform/direcciones-entrega/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId.trim())}`;
  }
  return `/api/direcciones-entrega/${encodeURIComponent(id)}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function DireccionEntregaViewModal({
  direccionEntregaId,
  direccionTitulo,
  tenantId,
  onClose,
  editTo,
}: {
  direccionEntregaId: string;
  direccionTitulo?: string;
  tenantId?: string;
  onClose: () => void;
  editTo: string;
}) {
  const { getToken } = useAuth();
  const [row, setRow] = useState<DireccionEntrega | null>(null);
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
    (async () => {
      try {
        const data = await apiJson<DireccionEntrega>(
          direccionEntregaDetailUrl(direccionEntregaId, tenantId),
          () => getToken(),
        );
        if (!cancelled) {
          setRow(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setRow(null);
          setError(friendlyError(e, 'direccionesEntrega'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, direccionEntregaId, tenantId]);

  const titulo = row?.direccion ?? direccionTitulo ?? 'Dirección de entrega';

  return (
    <ViewModalShell
      title={titulo}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          <Link to={editTo} className={viewModalBtnPrimary}>
            Editar
          </Link>
        </>
      }
    >
      {loading && <p className="text-sm text-vialto-steel">Cargando detalle…</p>}
      {error && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {!loading && row && (
        <div className={viewModalGridClass}>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Dirección / Ruta</p>
            <p className="mt-1 text-sm">{row.direccion}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Alta</p>
            <p className="mt-1 text-sm">{fmtDate(row.createdAt)}</p>
          </div>
        </div>
      )}
    </ViewModalShell>
  );
}
