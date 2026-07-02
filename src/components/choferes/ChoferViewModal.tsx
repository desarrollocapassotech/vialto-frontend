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
import type { Chofer } from '@/types/api';

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function choferDetailUrl(id: string, tenantId?: string): string {
  if (tenantId?.trim()) {
    return `/api/platform/choferes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId.trim())}`;
  }
  return `/api/choferes/${encodeURIComponent(id)}`;
}

export function ChoferViewModal({
  choferId,
  nombreTitulo,
  tenantId,
  showPin = false,
  onClose,
  editTo,
}: {
  choferId: string;
  nombreTitulo?: string;
  tenantId?: string;
  /** Mostrar estado del PIN para la app vialto-combustible (solo si el tenant tiene el módulo). */
  showPin?: boolean;
  onClose: () => void;
  editTo: string;
}) {
  const { getToken } = useAuth();
  const [chofer, setChofer] = useState<Chofer | null>(null);
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
        const row = await apiJson<Chofer>(choferDetailUrl(choferId, tenantId), () => getToken());
        if (!cancelled) {
          setChofer(row);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setChofer(null);
          setError(friendlyError(e, 'choferes'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, choferId, tenantId]);

  const titulo = chofer?.nombre ?? nombreTitulo ?? 'Chofer';

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
      {loading && (
        <p className="text-sm text-vialto-steel">Cargando detalle…</p>
      )}
      {error && (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}
      {!loading && chofer && (
        <div className={viewModalGridClass}>
          {[
            { label: 'Nombre', value: chofer.nombre },
            { label: 'DNI', value: chofer.dni },
            { label: 'CUIT', value: chofer.cuit },
            { label: 'N.° Licencia', value: chofer.licencia },
            {
              label: 'Vto. Licencia',
              value: chofer.licenciaVence ? fmtDate(chofer.licenciaVence) : null,
            },
            { label: 'Teléfono', value: chofer.telefono },
            { label: 'Alta', value: fmtDate(chofer.createdAt) },
          ]
            .filter((c) => c.value != null && c.value !== '')
            .map((c, i) => (
              <div key={i}>
                <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</p>
                <p className="mt-1 text-sm">{c.value}</p>
              </div>
            ))}
          {showPin && (
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">PIN combustible</p>
              <div className="mt-1">
                {chofer.pinConfigured ? (
                  <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">Configurado ✓</span>
                ) : (
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Sin PIN</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </ViewModalShell>
  );
}
