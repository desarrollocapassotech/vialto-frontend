import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from '@/components/ui/ViewModalShell';
import type { PlatformUser } from '@/types/api';

function formatRole(role: string, platformRole?: string | null) {
  if (platformRole === 'superadmin') return 'Superadmin';
  if (role === 'org:admin') return 'Admin';
  if (role === 'org:supervisor' || role === 'org:member') return 'Miembro';
  return role;
}

function formatDate(value: number | string) {
  try {
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
      typeof value === 'number' ? new Date(value) : new Date(value),
    );
  } catch {
    return '—';
  }
}

export function UserViewModal({
  user,
  tenantId,
  onClose,
}: {
  user: PlatformUser;
  tenantId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const nombreCompleto = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  const editTo = user.userId
    ? `/superadmin/usuarios/${encodeURIComponent(user.userId)}/editar?tenantId=${encodeURIComponent(tenantId)}`
    : null;

  return (
    <ViewModalShell
      title={nombreCompleto}
      onClose={onClose}
      maxWidthClass="sm:max-w-md"
      footer={
        <>
          <button type="button" onClick={onClose} className={viewModalBtnGhost}>
            Cerrar
          </button>
          {editTo && (
            <Link to={editTo} className={viewModalBtnPrimary}>
              Editar
            </Link>
          )}
        </>
      }
    >
      <div className={viewModalGridClass}>
        {[
          { label: 'Nombre', value: nombreCompleto },
          { label: 'Email', value: user.email },
          { label: 'Rol', value: formatRole(user.role, user.platformRole) },
          { label: 'Alta', value: formatDate(user.createdAt) },
        ].filter(c => c.value != null && c.value !== '').map((c, i) => (
          <div key={i}>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</p>
            <p className="mt-1 text-sm">{c.value}</p>
          </div>
        ))}
      </div>
    </ViewModalShell>
  );
}
