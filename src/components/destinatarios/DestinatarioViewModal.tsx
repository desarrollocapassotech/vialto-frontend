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
import type { Destinatario } from '@/types/api';

function destinatarioDetailUrl(id: string, tenantId?: string): string {
  if (tenantId?.trim()) {
    return `/api/platform/destinatarios/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId.trim())}`;
  }
  return `/api/destinatarios/${encodeURIComponent(id)}`;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function DestinatarioViewModal({
  destinatarioId,
  nombreTitulo,
  tenantId,
  onClose,
  editTo,
}: {
  destinatarioId: string;
  nombreTitulo?: string;
  tenantId?: string;
  onClose: () => void;
  editTo: string;
}) {
  const { getToken } = useAuth();
  const [destinatario, setDestinatario] = useState<Destinatario | null>(null);
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
        const row = await apiJson<Destinatario>(
          destinatarioDetailUrl(destinatarioId, tenantId),
          () => getToken(),
        );
        if (!cancelled) {
          setDestinatario(row);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setDestinatario(null);
          setError(friendlyError(e, 'destinatarios'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, destinatarioId, tenantId]);

  const titulo = destinatario?.nombre ?? nombreTitulo ?? 'Destinatario';

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
      {!loading && destinatario && (
        <div className={viewModalGridClass}>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Nombre</p>
            <p className="mt-1 text-sm">{destinatario.nombre}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Alta</p>
            <p className="mt-1 text-sm">{fmtDate(destinatario.createdAt)}</p>
          </div>
        </div>
      )}
    </ViewModalShell>
  );
}
